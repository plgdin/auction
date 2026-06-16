import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
import { parseMstcCatalogText } from '../scraper/parsers/mstcParser.js';
import { renderPdfFirstPage } from '../scraper/utils/pdfUtils.js';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});



async function executeBackfill(task: 'parse' | 'images' | 'both') {
  console.log(`Starting backfill operation (mode: ${task.toUpperCase()})...`);
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, raw_materials_text, category_name, seller_name, location')
    .eq('asset_status', 'completed')
    .not('sanitized_document_path', 'is', null);

  if (error) {
    console.error('Failed to query completed records:', error.message);
    return;
  }

  console.log(`Found ${records?.length || 0} completed records to process.`);

  let index = 0;
  for (const record of records || []) {
    index++;
    try {
      console.log(`[${index}/${records.length}] Processing ${record.mstc_auction_number}...`);
      const res = await fetch(record.sanitized_document_path!);
      if (!res.ok) {
        console.warn(` - Skip (Download failed: ${res.statusText})`);
        continue;
      }
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
        console.warn(' - Skip (Downloaded buffer is not PDF)');
        continue;
      }



      let summaryObj: any = null;
      if (record.raw_materials_text) {
        try {
          summaryObj = JSON.parse(record.raw_materials_text);
        } catch { /* ignore */ }
      }

      if (task === 'parse' || task === 'both') {
        const parsedPdf = await pdf(buffer);
        if (parsedPdf?.text) {
          const parsedObj = parseMstcCatalogText(
            parsedPdf.text,
            record.category_name || '',
            record.seller_name || '',
            record.location || ''
          );
          // Preserve any existing preview_image_url and extracted_images if they exist in summaryObj
          if (summaryObj) {
            if (summaryObj.preview_image_url) parsedObj.preview_image_url = summaryObj.preview_image_url;
            if (summaryObj.extracted_images) parsedObj.extracted_images = summaryObj.extracted_images;
          }
          summaryObj = parsedObj;
        }
      }

      if (task === 'images' || task === 'both') {
        // Render preview image and upload it
        const imageBuffer = await renderPdfFirstPage(buffer);
        if (imageBuffer) {
          const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
          const previewStoragePath = `mstc-previews/${sanitizedAuctionNum}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('auction_documents')
            .upload(previewStoragePath, imageBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error(` - Error uploading preview image: ${uploadError.message}`);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('auction_documents')
              .getPublicUrl(previewStoragePath);
            console.log(` - Uploaded preview image: ${publicUrlData.publicUrl}`);
            if (!summaryObj) {
              summaryObj = {};
            }
            summaryObj.preview_image_url = publicUrlData.publicUrl;
          }
        }
      }

      if (summaryObj) {
        const { error: updateError } = await supabase
          .from('mstc_auctions')
          .update({
            raw_materials_text: JSON.stringify(summaryObj)
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(` - Database update failed: ${updateError.message}`);
        } else {
          console.log(` - Successfully updated database row.`);
        }
      }
    } catch (err: any) {
      console.error(` - Fatal error processing row: ${err.message}`);
    }
  }
}export { executeBackfill };

// Run automatically if this is the main entry file
const isMain = process.argv[1] && (
  process.argv[1].endsWith('backfill.ts') || 
  process.argv[1].endsWith('backfill.js')
);

if (isMain) {
  const taskArg = (process.argv[2] || 'both').toLowerCase() as 'parse' | 'images' | 'both';
  if (!['parse', 'images', 'both'].includes(taskArg)) {
    console.log('Usage: npx tsx scratch/backfill.ts [parse|images|both]');
    process.exit(0);
  }
  executeBackfill(taskArg);
}
