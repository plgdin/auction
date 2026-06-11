import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testPdfParse() {
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
    console.log('No completed auctions found in database. Let\'s fetch one with a placeholder or run the assetWorker.');
    return;
  }

  const record = data[0];
  console.log(`Fetching PDF from: ${record.sanitized_document_path}`);

  const res = await fetch(record.sanitized_document_path!);
  if (!res.ok) {
    console.error(`Failed to fetch PDF: ${res.statusText}`);
    return;
  }

  const buffer = await res.buffer();
  console.log(`Downloaded ${buffer.length} bytes. Parsing PDF...`);

  const parsedPdf = await pdf(buffer);
  const text = parsedPdf.text;
  console.log(`Parsed text length: ${text.length}`);
  fs.writeFileSync('scratch_pdf_text.txt', text, 'utf-8');
  console.log('Text saved to scratch_pdf_text.txt');
  console.log('\n--- First 1000 characters of PDF Text ---');
  console.log(text.substring(0, 1000));
}

testPdfParse();
