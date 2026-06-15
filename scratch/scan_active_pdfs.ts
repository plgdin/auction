import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function scanActivePDFs() {
  const now = new Date().toISOString();
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, category_name, seller_name, sanitized_document_path')
    .gt('closing_date', now);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Scanning PDFs for ${records?.length || 0} active auctions...`);

  for (const record of records || []) {
    if (!record.sanitized_document_path) continue;
    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) continue;
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') continue;

      const parsedPdf = await pdf(buffer);
      const text = parsedPdf.text;
      
      // Look for indicators of lists, tables, or sub-items
      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      
      // Let's check for lines that look like: Item description, serial numbers, or itemized tables
      // For instance, lines containing multiple quantity units or specific model numbers
      const subItemLines = lines.filter((line: string) => {
        const lower = line.toLowerCase();
        // Look for common patterns of detail tables: e.g. numbered items, unit quantities, or description headers
        return (
          /^\d+\s*[\.\-]\s*[A-Za-z0-9]/i.test(line) &&
          (lower.includes('qty') || lower.includes('quantity') || lower.includes('model') || lower.includes('make') || lower.includes('brand') || /\b\d+\s*(nos|no|mt|kgs|kg|lot|set|pcs|pc)\b/i.test(lower))
        );
      });

      if (subItemLines.length > 3) {
        console.log(`\n----------------------------------------`);
        console.log(`POSSIBLE DETAILED CATALOG FOUND:`);
        console.log(`Auction Number: ${record.mstc_auction_number}`);
        console.log(`Seller:         ${record.seller_name}`);
        console.log(`Category:       ${record.category_name}`);
        console.log(`Document Path:  ${record.sanitized_document_path}`);
        console.log(`Found ${subItemLines.length} candidate detail lines:`);
        console.log(subItemLines.slice(0, 10).map((l: string) => `  * ${l}`).join('\n'));
      }
    } catch (err: any) {
      // Quietly continue
    }
  }
  console.log('\nScan complete.');
}

scanActivePDFs();
