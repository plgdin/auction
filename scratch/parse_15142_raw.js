import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("Credentials not found");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const auctionId = '805b9273-5e69-4995-bd8b-072ddad25762';
  console.log(`Downloading PDF for auction ${auctionId}...`);
  const { data, error } = await supabase.storage
    .from('auction_documents')
    .download(`mstc-catalogs/${auctionId}.pdf`);

  if (error) {
    console.error("Failed to download PDF:", error);
    process.exit(1);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  console.log("Parsing PDF text...");
  const parsedPdf = await pdf(buffer);
  const rawText = parsedPdf.text;
  
  const rawPath = path.join(__dirname, 'raw_text_15142.txt');
  fs.writeFileSync(rawPath, rawText, 'utf8');
  console.log(`Saved raw text to ${rawPath}`);
  
  // Let's print out text that contains Lot 09/ALD or Lot Name or surrounding text
  console.log("Analyzing text for Lot 09/ALD, Lot 10/ALD, etc...");
  const lines = rawText.split('\n');
  const matchingLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('09/ALD') || line.includes('10/ALD') || line.includes('11/ALD') || line.includes('13/ALD') || line.includes('14/ALD')) {
      console.log(`Line ${i}: ${line}`);
      // Log surrounding lines
      for (let j = Math.max(0, i - 15); j <= Math.min(lines.length - 1, i + 35); j++) {
        matchingLines.push(`[L${j}] ${lines[j]}`);
      }
      matchingLines.push('==================================================');
    }
  }
  
  fs.writeFileSync(path.join(__dirname, 'extracted_lot_sections.txt'), matchingLines.join('\n'), 'utf8');
  console.log("Saved extracted sections to scratch/extracted_lot_sections.txt");
}

check();
