import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
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

function parseMstcCatalogText(text: string): any {
  const lines = text.split('\n').map(l => l.trim());
  const cleanText = lines.join('\n');

  let emdValue = '10% of total bid value';
  let preBidDdg = 'Not required for registered MSME bidders';

  const emdPercentMatch = cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*\n*([\d\.]+)/i) || cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*([\d\.]+)/i);
  if (emdPercentMatch) {
    emdValue = `${emdPercentMatch[1]}% of total bid value (Post-Bid EMD)`;
  } else {
    const preBidMatch = cleanText.match(/Pre-Bid EMD:\s*([^\n]+)/);
    if (preBidMatch) {
      const matchVal = preBidMatch[1].trim();
      if (!matchVal.toLowerCase().includes('not a auto') && !matchVal.toLowerCase().includes('item wise')) {
        const numOnly = matchVal.replace(/[^\d]/g, '');
        if (numOnly && parseInt(numOnly, 10) > 100) {
          preBidDdg = `₹${parseInt(numOnly, 10).toLocaleString('en-IN')}`;
          emdValue = '10% of total bid value';
        } else {
          emdValue = matchVal;
        }
      }
    }
  }

  const explicitPreBidMatch = cleanText.match(/(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]{4,10})/i);
  if (explicitPreBidMatch) {
    const val = explicitPreBidMatch[1].replace(/,/g, '');
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 100) {
      preBidDdg = `₹${num.toLocaleString('en-IN')}`;
    }
  }

  return { emdValue, preBidDdg };
}

async function inspectRecord(searchTerm: string) {
  console.log(`Searching for record matching "${searchTerm}"...`);
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .ilike('mstc_auction_number', `%${searchTerm}%`)
    .limit(1);

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
    require('fs').writeFileSync('scratch/pdf_text.txt', text);
    console.log('PDF text written to scratch/pdf_text.txt');

    console.log('\n=================== PDF Parsing Diagnostic ===================');
    const diagnostic = parseMstcCatalogText(text);
    console.log('Extracted EMD Value:    ', diagnostic.emdValue);
    console.log('Extracted Pre-Bid DDG:  ', diagnostic.preBidDdg);

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
