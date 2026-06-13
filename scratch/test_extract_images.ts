import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testExtract() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path')
    .eq('asset_status', 'completed')
    .limit(1);

  if (error) {
    console.error('Error fetching auctions:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No completed auctions found in database.');
    return;
  }

  const record = data[0];
  console.log(`Downloading PDF from: ${record.sanitized_document_path}`);
  const res = await fetch(record.sanitized_document_path!);
  if (!res.ok) {
    console.error(`Failed to download: ${res.statusText}`);
    return;
  }
  const pdfBuffer = await res.buffer();
  console.log(`Downloaded PDF size: ${pdfBuffer.length} bytes`);

  const images = extractJpegs(pdfBuffer);
  console.log(`Extracted ${images.length} JPEGs.`);
  
  images.forEach((img, index) => {
    const filename = `scratch/extracted_img_${index}.jpg`;
    fs.writeFileSync(filename, img);
    console.log(`Saved ${filename} (${img.length} bytes)`);
  });
}

function extractJpegs(pdfBuffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;

  while (pos < pdfBuffer.length) {
    const streamIdx = pdfBuffer.indexOf('stream', pos);
    if (streamIdx === -1) break;

    const dictStart = pdfBuffer.lastIndexOf('<<', streamIdx);
    if (dictStart !== -1) {
      const dictBuffer = pdfBuffer.slice(dictStart, streamIdx);
      const dictStr = dictBuffer.toString('ascii');

      if (dictStr.includes('/Subtype /Image') && dictStr.includes('/Filter /DCTDecode')) {
        const endstreamIdx = pdfBuffer.indexOf('endstream', streamIdx);
        if (endstreamIdx !== -1) {
          let start = streamIdx + 6;
          while (start < endstreamIdx && (pdfBuffer[start] === 10 || pdfBuffer[start] === 13)) {
            start++;
          }
          let end = endstreamIdx;
          while (end > start && (pdfBuffer[end - 1] === 10 || pdfBuffer[end - 1] === 13)) {
            end--;
          }

          const streamData = pdfBuffer.slice(start, end);
          if (streamData.length > 0) {
            jpegs.push(streamData);
          }
        }
      }
    }
    pos = streamIdx + 6;
  }

  return jpegs;
}

testExtract().catch(err => console.error(err));
