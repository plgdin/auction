import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read env variables
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("Could not find credentials in .env.local");
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking auctions...");
  const { data: auctions, error: err1 } = await supabase.from('auctions').select('*');
  if (err1) {
    console.error("Error fetching auctions:", err1);
  } else {
    console.log(`Total auctions: ${auctions.length}`);
  }

  const { data: mstc, error: err2 } = await supabase.from('mstc_auctions').select('*');
  if (err2) {
    console.error("Error fetching mstc_auctions:", err2);
  } else {
    console.log(`Total mstc_auctions: ${mstc.length}`);
    const now = new Date();
    const upcoming = mstc.filter(a => new Date(a.closing_date) > now);
    console.log(`Upcoming mstc_auctions: ${upcoming.length}`);
    mstc.slice(0, 5).forEach((a, i) => {
      console.log(`[${i}] ID: ${a.id}`);
      console.log(`    Num: ${a.mstc_auction_number}`);
      console.log(`    Status: ${a.asset_status}`);
      console.log(`    Category: ${a.category_name}`);
      console.log(`    Location: ${a.location}`);
      console.log(`    Closing: ${a.closing_date}`);
    });
  }
}

check();
