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
    .select('id, mstc_auction_number, asset_status, scraped_at, updated_at')
    .eq('id', '805b9273-5e69-4995-bd8b-072ddad25762')
    .single();

  if (error) {
    console.error("DB error:", error);
    process.exit(1);
  }

  console.log("RECORD TIMESTAMPS:");
  console.log(JSON.stringify(record, null, 2));
}

check();
