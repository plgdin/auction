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

interface Anomaly {
  auctionId: string;
  auctionNumber: string;
  reasons: string[];
}

async function run() {
  if (!fs.existsSync('scratch/anomaly_report.json')) {
    console.log("No anomaly report found at scratch/anomaly_report.json");
    return;
  }
  
  const anomalies: Anomaly[] = JSON.parse(fs.readFileSync('scratch/anomaly_report.json', 'utf8'));
  console.log(`Loaded ${anomalies.length} anomalous auctions for reparsing...`);
  
  // Filter out false positives from the Pincode rule if the description already seems clean
  // We prioritize reparsing malformed serials and generic category fallbacks
  const targets = anomalies.filter(anom => {
    return anom.reasons.some(r => 
      r.includes("Malformed/Wrapped Serial Number") || 
      r.includes("Zero Serial Number") || 
      r.includes("address/location keywords") || 
      r.includes("Generic category fallback")
    );
  });
  
  console.log(`Found ${targets.length} auctions matching high-priority parser error patterns.`);
  
  // Process target auctions in chunks of 5 for speed and safety
  const chunkSize = 5;
  let successCount = 0;
  
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    console.log(`\nProcessing target chunk ${i / chunkSize + 1} of ${Math.ceil(targets.length / chunkSize)}...`);
    
    await Promise.all(chunk.map(async (target) => {
      try {
        // 1. Fetch current record
        const { data: record, error: fetchErr } = await supabase
          .from('mstc_auctions')
          .select('id, category_name, seller_name, location, sanitized_document_path, raw_materials_text')
          .eq('id', target.auctionId)
          .single();
          
        if (fetchErr || !record) {
          console.warn(`[${target.auctionNumber}] Failed to fetch record:`, fetchErr?.message);
          return;
        }
        
        // Get storage relative path from sanitized_document_path
        const urlStr = record.sanitized_document_path || '';
        if (!urlStr) return;
        
        let path = '';
        try {
          const url = new URL(urlStr);
          const parts = url.pathname.split('/storage/v1/object/public/auction_documents/');
          if (parts.length > 1) {
            path = parts[1];
          }
        } catch (e) {
          console.warn(`[${target.auctionNumber}] Failed to parse path from URL:`, urlStr);
          return;
        }
        
        if (!path) return;
        
        // 2. Download PDF
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('auction_documents')
          .download(path);
          
        if (downloadError) {
          console.warn(`[${target.auctionNumber}] Download failed:`, downloadError.message);
          return;
        }
        
        const buffer = Buffer.from(await fileData.arrayBuffer());
        
        // 3. Extract text and parse
        const parsedPdf = await pdf(buffer);
        const text = parsedPdf.text;
        
        const newParsed = parseMstcCatalogText(
          text,
          record.category_name || '',
          record.seller_name || '',
          record.location || 'India'
        );
        
        const oldStr = record.raw_materials_text || '';
        const newStr = JSON.stringify(newParsed);
        
        if (oldStr === newStr) {
          console.log(`[${target.auctionNumber}] Parser output is identical, no change needed.`);
          return;
        }
        
        // 4. Save back to DB
        const { error: updateErr } = await supabase
          .from('mstc_auctions')
          .update({
            raw_materials_text: newStr,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
          
        if (updateErr) {
          console.warn(`[${target.auctionNumber}] Update failed:`, updateErr.message);
        } else {
          console.log(`[${target.auctionNumber}] Successfully re-parsed and updated in database.`);
          successCount++;
        }
      } catch (err: any) {
        console.warn(`[${target.auctionNumber}] Error during processing:`, err.message);
      }
    }));
  }
  
  console.log(`\n==================================================`);
  console.log(`Reparsing Completed.`);
  console.log(`Total Target Auctions Reparsed and Updated: ${successCount}`);
  console.log(`==================================================\n`);
}

run();
