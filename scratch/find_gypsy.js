import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, raw_materials_text');

  if (error) {
    console.error("DB error:", error);
    process.exit(1);
  }

  console.log(`Searching through ${records.length} records...`);
  for (const record of records) {
    if (record.raw_materials_text && record.raw_materials_text.toLowerCase().includes('gypsy')) {
      console.log(`Found Gypsy in auction:`);
      console.log(`ID: ${record.id}`);
      console.log(`Number: ${record.mstc_auction_number}`);
      try {
        const parsed = JSON.parse(record.raw_materials_text);
        console.log(`Items count: ${parsed.items?.length}`);
      } catch (e) {
        console.log("Failed to parse raw_materials_text");
      }
      return;
    }
  }
  console.log("No record found with 'gypsy' in description");
}

check();
