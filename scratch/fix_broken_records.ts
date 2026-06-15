/**
 * Re-process the previously broken records: re-parse their PDFs and
 * update the database with the corrected structured data.
 * 
 * Usage: npx tsx scratch/fix_broken_records.ts
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
  // Find records that have only fallback items in their stored JSON
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, category_name, seller_name, location, raw_materials_text')
    .eq('asset_status', 'completed')
    .not('sanitized_document_path', 'is', null)
    .not('raw_materials_text', 'is', null);

  if (error || !records) {
    console.error('Query failed:', error?.message);
    return;
  }

  // Filter to only records with fallback-only parsed data
  const brokenRecords = records.filter(r => {
    try {
      const parsed = JSON.parse(r.raw_materials_text);
      const items = parsed.items || [];
      return items.length === 1 && 
        (items[0].description === 'Auction Lot Items' || items[0].description === r.category_name);
    } catch {
      return true; // Invalid JSON also counts as broken
    }
  });

  console.log(`Found ${brokenRecords.length} records with broken/fallback parsing to fix.\n`);

  if (brokenRecords.length === 0) {
    console.log('Nothing to fix!');
    return;
  }

  let fixed = 0;
  let stillBroken = 0;

  for (const record of brokenRecords) {
    console.log(`Processing: ${record.mstc_auction_number}`);

    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) { console.log(`  [SKIP] Download failed`); stillBroken++; continue; }
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') { console.log(`  [SKIP] Not a PDF`); stillBroken++; continue; }

      const parsedPdf = await pdf(buffer);
      const text: string = parsedPdf.text || '';

      const result = parseMstcCatalogText(
        text,
        record.category_name || '',
        record.seller_name || '',
        record.location || ''
      );

      // Preserve existing preview_image_url and extracted_images from old data
      try {
        const oldParsed = JSON.parse(record.raw_materials_text);
        if (oldParsed.preview_image_url) result.preview_image_url = oldParsed.preview_image_url;
        if (oldParsed.extracted_images) result.extracted_images = oldParsed.extracted_images;
      } catch { /* ignore */ }

      const newJson = JSON.stringify(result);

      const { error: updateError } = await supabase
        .from('mstc_auctions')
        .update({ raw_materials_text: newJson })
        .eq('id', record.id);

      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
        stillBroken++;
      } else {
        console.log(`  ✅ Fixed — ${result.items.length} lots extracted`);
        fixed++;
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      stillBroken++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DONE: ${fixed} fixed, ${stillBroken} still broken`);
  console.log('='.repeat(60));
}

run().catch(console.error);
