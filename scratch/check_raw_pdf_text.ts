import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: record, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .ilike('mstc_auction_number', '%8714%')
    .single();

  if (error || !record) {
    console.error('Error finding auction:', error);
    return;
  }

  console.log('Auction Number:', record.mstc_auction_number);
  console.log('PDF URL:', record.source_pdf_url);
  console.log('Sanitized Doc Path:', record.sanitized_document_path);

  // Fetch the PDF
  const res = await fetch(record.sanitized_document_path || record.source_pdf_url);
  if (!res.ok) {
    console.error('Failed to download PDF:', res.statusText);
    return;
  }
  const buffer = await res.buffer();
  const parsed = await pdf(buffer);
  console.log('--- FIRST 2000 CHARACTERS OF PDF TEXT ---');
  console.log(parsed.text.slice(0, 2000));
  console.log('--- END OF SAMPLE ---');

  // Let's write the entire text to a temporary scratch file so we can view it
  const fs = require('fs');
  fs.writeFileSync('scratch/raw_pdf_text_8714.txt', parsed.text);
  console.log('Saved raw text to scratch/raw_pdf_text_8714.txt');
}

run().catch(console.error);
