/**
 * Verify the parser fix against the 4 previously failing records.
 * Usage: npx tsx scratch/verify_parser_fix.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
import { parseMstcCatalogText } from '../scraper/parsers/mstcParser.js';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FAILING = [
  '%BSNL, RAJKOT%',
  '%DHL EXPRESS%',
  '%KODUMUR%',
  '%BEML LIMITED%13045%',
];

async function run() {
  let totalPassed = 0;
  let totalFailed = 0;

  for (const pattern of FAILING) {
    const { data: records } = await supabase
      .from('mstc_auctions')
      .select('mstc_auction_number, sanitized_document_path, category_name, seller_name, location')
      .ilike('mstc_auction_number', pattern)
      .eq('asset_status', 'completed')
      .limit(1);

    if (!records || records.length === 0) {
      console.log(`[SKIP] No record found for pattern: ${pattern}`);
      continue;
    }

    const record = records[0];
    console.log(`\n=== ${record.mstc_auction_number} ===`);

    if (!record.sanitized_document_path) {
      console.log(`  [SKIP] No document path`);
      continue;
    }

    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) { console.log(`  [SKIP] Download failed`); continue; }
      const buffer = await res.buffer();
      const parsedPdf = await pdf(buffer);
      const text: string = parsedPdf.text || '';

      const result = parseMstcCatalogText(
        text,
        record.category_name || '',
        record.seller_name || '',
        record.location || ''
      );

      const itemCount = result.items.length;
      const hasFallbackOnly = itemCount === 1 && 
        (result.items[0].description === 'Auction Lot Items' || result.items[0].description === record.category_name);

      if (hasFallbackOnly) {
        console.log(`  ❌ STILL FAILING — Only fallback item`);
        totalFailed++;
      } else {
        console.log(`  ✅ FIXED — Extracted ${itemCount} lot(s)`);
        totalPassed++;
      }

      // Print first 5 items
      result.items.slice(0, 5).forEach((item, idx) => {
        console.log(`     [${idx + 1}] sr="${item.sr}" desc="${item.description.slice(0, 60)}" qty=${item.qty} ${item.unit}`);
      });
      if (itemCount > 5) {
        console.log(`     ... and ${itemCount - 5} more lots`);
      }

    } catch (err: any) {
      console.log(`  [ERROR] ${err.message}`);
      totalFailed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(60));
}

run().catch(console.error);
