/**
 * Re-parse ALL completed records using the fixed parser and compare.
 * Usage: npx tsx scratch/reparse_all.ts
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

async function run() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, category_name, seller_name, location')
    .eq('asset_status', 'completed')
    .not('sanitized_document_path', 'is', null)
    .limit(50);

  if (error || !records) {
    console.error('Query failed:', error?.message);
    return;
  }

  console.log(`Re-parsing ${records.length} completed records with fixed parser...\n`);

  let passed = 0;
  let failed = 0;
  const failures: { num: string; reason: string }[] = [];

  for (const record of records) {
    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) { failed++; failures.push({ num: record.mstc_auction_number, reason: `Download failed: ${res.status}` }); continue; }
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') { failed++; failures.push({ num: record.mstc_auction_number, reason: 'Not a valid PDF' }); continue; }

      const parsedPdf = await pdf(buffer);
      const text: string = parsedPdf.text || '';

      const result = parseMstcCatalogText(
        text,
        record.category_name || '',
        record.seller_name || '',
        record.location || ''
      );

      const hasFallbackOnly = result.items.length === 1 &&
        (result.items[0].description === 'Auction Lot Items' || result.items[0].description === record.category_name);

      if (hasFallbackOnly) {
        failed++;

        // Show what patterns exist in the text  
        const lotNoPatterns = text.match(/Lot\s*No\s*[-:.]\s*/gi) || [];
        const lotBlocks = text.split(/Lot No\s*-\s*/);

        failures.push({
          num: record.mstc_auction_number,
          reason: `Fallback only. "Lot No -" splits: ${lotBlocks.length - 1}. lotNo patterns in text: ${lotNoPatterns.length}. Text length: ${text.length}`
        });

        // Show the first 30 non-empty lines
        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        console.log(`\n  FAIL: ${record.mstc_auction_number}`);
        console.log(`  Lot blocks: ${lotBlocks.length - 1}, Text: ${text.length} chars`);
        console.log(`  First 30 lines:`);
        lines.slice(0, 30).forEach((l: string, i: number) => console.log(`    ${i + 1}: ${l}`));
        
        // Show any lines with lot/item/qty keywords
        console.log(`  Lot/item keyword lines:`);
        lines.forEach((l: string, i: number) => {
          if (/lot\s*no|lot\s*name|lot\s*details/i.test(l)) {
            console.log(`    ${i + 1}: ${l}`);
          }
        });

      } else {
        passed++;
        process.stdout.write('.');
      }
    } catch (err: any) {
      failed++;
      failures.push({ num: record.mstc_auction_number, reason: `Error: ${err.message}` });
    }
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${passed}/${records.length} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ${f.num}: ${f.reason}`);
    }
  }
}

run().catch(console.error);
