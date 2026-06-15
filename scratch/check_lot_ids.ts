/**
 * Quick check: what does the first line of each lot block look like?
 */
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
  const FAILING = [
    '%BSNL, RAJKOT%',
    '%DHL EXPRESS%',
    '%KODUMUR%',
    '%BEML LIMITED%13045%',
  ];

  for (const pattern of FAILING) {
    const { data: records } = await supabase
      .from('mstc_auctions')
      .select('mstc_auction_number, sanitized_document_path')
      .ilike('mstc_auction_number', pattern)
      .eq('asset_status', 'completed')
      .limit(1);

    if (!records || records.length === 0) continue;

    const record = records[0];
    console.log(`\n=== ${record.mstc_auction_number} ===`);
    
    if (!record.sanitized_document_path) continue;
    
    const res = await fetch(record.sanitized_document_path);
    if (!res.ok) continue;
    const buffer = await res.buffer();
    const parsedPdf = await pdf(buffer);
    const text: string = parsedPdf.text || '';

    const lotBlocks = text.split(/Lot No\s*-\s*/);
    console.log(`Split into ${lotBlocks.length - 1} lot blocks`);

    for (let i = 1; i < Math.min(lotBlocks.length, 6); i++) {
      const block = lotBlocks[i];
      const firstLines = block.split('\n').slice(0, 5).map((l: string) => l.trim());
      console.log(`\n  Block ${i} — first 5 lines:`);
      firstLines.forEach((l: string, j: number) => console.log(`    ${j}: "${l}"`));
      
      // Test parseInt
      const lotNo = parseInt(firstLines[0]);
      console.log(`    parseInt("${firstLines[0]}") = ${lotNo} → isNaN: ${isNaN(lotNo)}`);
    }
  }
}

run().catch(console.error);
