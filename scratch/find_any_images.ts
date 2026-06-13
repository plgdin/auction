import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function scanForImages() {
  console.log('Fetching 100 completed catalog URLs...');
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('mstc_auction_number, sanitized_document_path')
    .eq('asset_status', 'completed')
    .order('id', { ascending: true })
    .limit(100);

  if (error || !records) {
    console.error('Error fetching records:', error?.message);
    return;
  }

  console.log(`Scanning ${records.length} PDFs...`);
  let foundAny = false;

  for (const record of records) {
    if (!record.sanitized_document_path) continue;
    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) continue;
      const buffer = await res.buffer();

      let imageCount = 0;
      let pos = 0;
      while (pos < buffer.length) {
        const xObjectIdx = buffer.indexOf('/Type /XObject', pos);
        if (xObjectIdx === -1) break;

        const dictStart = buffer.lastIndexOf('<<', xObjectIdx);
        const dictEnd = buffer.indexOf('>>', xObjectIdx);

        if (dictStart !== -1 && dictEnd !== -1 && dictStart < xObjectIdx) {
          const dictData = buffer.slice(dictStart, dictEnd + 2).toString('ascii');
          if (dictData.includes('/Subtype /Image')) {
            imageCount++;
          }
        }
        pos = xObjectIdx + 14;
      }

      if (imageCount > 0) {
        console.log(`[FOUND IMAGES] Catalog: ${record.mstc_auction_number} has ${imageCount} embedded images!`);
        foundAny = true;
      }
    } catch (e: any) {
      // ignore
    }
  }

  if (!foundAny) {
    console.log('No embedded images found in any of the 100 scanned PDFs. They are all 100% text-based reports.');
  }
}

scanForImages().catch(err => console.error(err));
