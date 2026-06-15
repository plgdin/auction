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


async function processSingleRecord(searchTerm: string) {
  console.log(`Querying single record matching "${searchTerm}"...`);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm);
  const query = supabase.from('mstc_auctions').select('*');
  const { data: records, error } = await (isUuid 
    ? query.or(`id.eq.${searchTerm},mstc_auction_number.ilike.%${searchTerm}%`)
    : query.ilike('mstc_auction_number', `%${searchTerm}%`)
  ).limit(1);

  if (error) {
    console.error('Database query error:', error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log('No matching record found.');
    return;
  }

  const record = records[0];
  console.log(`Found record: ${record.mstc_auction_number} (status: ${record.asset_status})`);

  if (!record.sanitized_document_path) {
    console.error('No sanitized_document_path available for this record.');
    return;
  }

  console.log(`Downloading catalog PDF from: ${record.sanitized_document_path}`);
  const res = await fetch(record.sanitized_document_path);
  if (!res.ok) {
    console.error(`Download failed: ${res.statusText}`);
    return;
  }
  const buffer = await res.buffer();
  if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
    console.error('Downloaded file is not a valid PDF.');
    return;
  }

  console.log('Parsing catalog text...');
  const parsedPdf = await pdf(buffer);
  const text = parsedPdf.text;
  const summaryObj = parseMstcCatalogText(
    text,
    record.category_name || '',
    record.seller_name || '',
    record.location || ''
  );

  console.log('Rendering first-page thumbnail...');
  const imageBuffer = await renderPdfFirstPage(buffer);
  let previewUrl = '';
  try {
    const existing = JSON.parse(record.raw_materials_text || '{}');
    if (existing.preview_image_url) {
      previewUrl = existing.preview_image_url;
    }
  } catch { /* ignore */ }

  if (imageBuffer) {
    const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
    const previewStoragePath = `mstc-previews/${sanitizedAuctionNum}.jpg`;

    console.log(`Uploading preview image to storage...`);
    const { error: uploadError } = await supabase.storage
      .from('auction_documents')
      .upload(previewStoragePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`Preview upload failed: ${uploadError.message}`);
    } else {
      const { data: publicUrlData } = supabase.storage
          .from('auction_documents')
          .getPublicUrl(previewStoragePath);
      previewUrl = publicUrlData.publicUrl;
      console.log(`Uploaded preview image: ${previewUrl}`);
    }
  }

  if (previewUrl) {
    summaryObj.preview_image_url = previewUrl;
  }

  console.log('Updating database row...');
  const { error: updateError } = await supabase
    .from('mstc_auctions')
    .update({
      raw_materials_text: JSON.stringify(summaryObj),
      asset_status: 'completed'
    })
    .eq('id', record.id);

  if (updateError) {
    console.error(`Update failed: ${updateError.message}`);
  } else {
    console.log(`Successfully processed and completed auction record: ${record.mstc_auction_number}`);
  }
}

const arg = process.argv[2] || '';
if (!arg) {
  console.log('Usage: npx tsx scratch/process_single.ts <auction_number_fragment_or_uuid>');
  process.exit(0);
}
processSingleRecord(arg);
