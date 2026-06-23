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
  const { data: mstcCols } = await supabase.from('mstc_auctions').select('*').limit(1);
  console.log("mstc_auctions cols:", mstcCols ? Object.keys(mstcCols[0] || {}) : 'null');

  const { data: auctionCols } = await supabase.from('auctions').select('*').limit(1);
  console.log("auctions cols:", auctionCols ? Object.keys(auctionCols[0] || {}) : 'null');
}

check();
