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
  const { data: record, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .eq('id', 'f3e6a96b-cd49-41ff-ba1c-e133fdb9eb53')
    .single();

  if (error) {
    console.error("DB error:", error);
    process.exit(1);
  }

  if (record && record.raw_materials_text) {
    const parsed = JSON.parse(record.raw_materials_text);
    console.log("AUCTION NUMBER:", record.mstc_auction_number);
    console.log("ITEMS:");
    console.log(JSON.stringify(parsed.items, null, 2));
  } else {
    console.log("No record found");
  }
}

check();
