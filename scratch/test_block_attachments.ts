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

async function run() {
  const pattern = '%BEML LIMITED%13045%';
  const { data: records } = await supabase
    .from('mstc_auctions')
    .select('mstc_auction_number, sanitized_document_path')
    .ilike('mstc_auction_number', pattern)
    .eq('asset_status', 'completed')
    .limit(1);

  if (!records || records.length === 0) {
    console.error("No BEML record found");
    return;
  }

  const record = records[0];
  console.log(`=== ${record.mstc_auction_number} ===`);
  
  const res = await fetch(record.sanitized_document_path);
  if (!res.ok) {
    console.error("Failed to download PDF");
    return;
  }
  const buffer = await res.buffer();
  const parsedPdf = await pdf(buffer);
  const text: string = parsedPdf.text || '';

  const lotBlocks = text.split(/Lot No\s*-\s*/);
  console.log(`Split into ${lotBlocks.length - 1} lot blocks`);

  for (let i = 1; i < lotBlocks.length; i++) {
    const block = lotBlocks[i];
    console.log(`\n--- Block ${i} ---`);
    
    // Clean and match attachments in this block
    const cleanedBlockText = block
      .replace(/\r?\n/g, ' ')
      .replace(
        /(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
        (_match, p1, p2, p3, p4) => {
          return `${p1}${p2}${p3 || ''}${p4}`;
        }
      );

    const blockMatches = cleanedBlockText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
    const attachments = Array.from(new Set(blockMatches)).filter((name) => {
      const n = name.toLowerCase();
      return n.startsWith('photo_') || n.startsWith('annex_');
    });

    console.log(`Lot Text Preview (first 300 chars):`);
    console.log(block.slice(0, 300));
    console.log(`Extracted attachments:`, attachments);
  }
}

run().catch(console.error);
