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
  const { data: records } = await supabase
    .from('mstc_auctions')
    .select('raw_materials_text')
    .like('mstc_auction_number', '%15100%');

  if (records && records.length > 0) {
    const parsed = JSON.parse(records[0].raw_materials_text);
    console.log(JSON.stringify(parsed.items, null, 2));
  } else {
    console.log("No record found");
  }
}

check();
