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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectRecord(searchTerm: string) {
  console.log(`Searching for record matching "${searchTerm}"...`);
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
  console.log('\n=================== Database Fields ===================');
  console.log(`ID:                     ${record.id}`);
  console.log(`Auction Number:         ${record.mstc_auction_number}`);
  console.log(`Seller:                 ${record.seller_name}`);
  console.log(`Category:               ${record.category_name}`);
  console.log(`Location:               ${record.location}`);
  console.log(`Document Path:          ${record.sanitized_document_path}`);
  console.log(`Asset Status:           ${record.asset_status}`);
  console.log(`Raw Materials Text (DB):`);
  console.log(record.raw_materials_text);

  if (record.sanitized_document_path) {
    console.log('\nDownloading PDF to perform parse diagnostics...');
    const res = await fetch(record.sanitized_document_path);
    if (!res.ok) {
      console.error(`Failed to download PDF: ${res.status} ${res.statusText}`);
      return;
    }
    const buffer = await res.buffer();
    if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
      console.error('Downloaded file is not a valid PDF.');
      return;
    }

    const parsedPdf = await pdf(buffer);
    const text = parsedPdf.text;

    console.log('\n=================== PDF Parsing Diagnostic ===================');
    const diagnostic = parseMstcCatalogText(
      text,
      record.category_name || '',
      record.seller_name || '',
      record.location || ''
    );
    console.log('Extracted EMD Value:    ', diagnostic.depositDetails?.emd);
    console.log('Extracted Pre-Bid DDG:  ', diagnostic.depositDetails?.preBidDdg);

    console.log('\n--- Related PDF Context Lines ---');
    const lines = text.split('\n');
    lines.forEach((line: string, idx: number) => {
      if (/emd|pre-bid|post\s*bid|money|deposit/i.test(line)) {
        console.log(`Line ${idx}: ${line.trim()}`);
      }
    });
  }
}

// Pass ID or auction number fragment as command line arg, e.g. "npx tsx scratch/inspect_record.ts 12554"
const arg = process.argv[2] || '';
if (!arg) {
  console.log('Usage: npx tsx scratch/inspect_record.ts <auction_number_fragment_or_uuid>');
  process.exit(0);
}
inspectRecord(arg);
