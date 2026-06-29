import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { createRequire } from 'module';
import { parseMstcCatalogText } from '../scraper/parsers/mstcParser.js';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ParsedItem {
  sr: any;
  description: string;
  qty: string;
  unit: string;
}

interface ParsedAuction {
  items: ParsedItem[];
}

async function run() {
  console.log("Fetching all auctions from database...");
  
  const limit = 1000;
  let offset = 0;
  let allAuctions: any[] = [];
  
  while (true) {
    const { data, error } = await supabase
      .from('mstc_auctions')
      .select('id, mstc_auction_number, raw_materials_text, category_name, seller_name, location, sanitized_document_path')
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error("Error fetching data:", error);
      return;
    }
    
    if (!data || data.length === 0) break;
    allAuctions = allAuctions.concat(data);
    offset += limit;
  }
  
  console.log(`Total auctions retrieved: ${allAuctions.length}`);
  
  // Find auctions where at least one item has a generic unit ("lot", "lots", "unit", or empty)
  const targets: any[] = [];
  
  for (const record of allAuctions) {
    if (!record.raw_materials_text) continue;
    
    try {
      const parsed: ParsedAuction = JSON.parse(record.raw_materials_text);
      if (parsed && Array.isArray(parsed.items)) {
        const hasGenericUnit = parsed.items.some(item => {
          const u = (item.unit || '').toLowerCase().trim();
          const q = (item.qty || '').toLowerCase().trim();
          return !u || u === 'lot' || u === 'lots' || u === 'unit' || q.includes('lot');
        });
        
        if (hasGenericUnit && record.sanitized_document_path) {
          targets.push(record);
        }
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
  
  console.log(`Found ${targets.length} auctions containing items with generic 'LOT' / 'UNIT' units.`);
  
  // Save targets to file for tracing
  fs.writeFileSync('scratch/lot_targets.json', JSON.stringify(targets.map(t => ({ id: t.id, num: t.mstc_auction_number })), null, 2));
  
  const chunkSize = 5;
  let successCount = 0;
  
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    console.log(`\nProcessing target chunk ${i / chunkSize + 1} of ${Math.ceil(targets.length / chunkSize)}...`);
    
    await Promise.all(chunk.map(async (record) => {
      try {
        const urlStr = record.sanitized_document_path || '';
        let path = '';
        try {
          const url = new URL(urlStr);
          const parts = url.pathname.split('/storage/v1/object/public/auction_documents/');
          if (parts.length > 1) {
            path = parts[1];
          }
        } catch (e) {
          return;
        }
        
        if (!path) return;
        
        // Download PDF
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('auction_documents')
          .download(path);
          
        if (downloadError) {
          console.warn(`[${record.mstc_auction_number}] Download failed:`, downloadError.message);
          return;
        }
        
        const buffer = Buffer.from(await fileData.arrayBuffer());
        
        // Parse PDF text
        const parsedPdf = await pdf(buffer);
        
        // Re-parse with updated lotParser logic
        const newParsed = parseMstcCatalogText(
          parsedPdf.text,
          record.category_name || '',
          record.seller_name || '',
          record.location || 'India'
        );
        
        const oldStr = record.raw_materials_text || '';
        const newStr = JSON.stringify(newParsed);
        
        if (oldStr === newStr) {
          return; // No improvement/change found
        }
        
        // Save back to DB
        const { error: updateErr } = await supabase
          .from('mstc_auctions')
          .update({
            raw_materials_text: newStr,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
          
        if (updateErr) {
          console.warn(`[${record.mstc_auction_number}] DB update failed:`, updateErr.message);
        } else {
          console.log(`[${record.mstc_auction_number}] Successfully updated with specific unit metrics.`);
          successCount++;
        }
      } catch (err: any) {
        console.warn(`[${record.mstc_auction_number}] Error:`, err.message);
      }
    }));
  }
  
  console.log(`\n==================================================`);
  console.log(`Lot Unit Reparsing Completed.`);
  console.log(`Total Target Auctions Updated with Correct Units: ${successCount}`);
  console.log(`==================================================\n`);
}

run();
