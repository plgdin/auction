import fetch from 'node-fetch';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function dumpPDF(url: string, dest: string) {
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  const buffer = await res.buffer();
  const parsedPdf = await pdf(buffer);
  fs.writeFileSync(dest, parsedPdf.text, 'utf-8');
  console.log(`Saved text to ${dest}`);
}

async function run() {
  await dumpPDF(
    'https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-catalogs/MSTC_CDG_POWER%20GRID%20CORPORATION%20OF%20INDIA%20LTD_1_SARNA,%20DIST.%20PATHANKOT_26-27_13078.pdf',
    'scratch/powergrid_text.txt'
  );
  await dumpPDF(
    'https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-catalogs/MSTC_GHY_Supply%20Depot%20ASC%20Dimapur%20_1_Dimapur_26-27_8714.pdf',
    'scratch/dimapur_text.txt'
  );
}

run();
