import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Querying newest 20 auctions...');
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, asset_status, opening_date, closing_date, raw_materials_text')
    .order('scraped_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const record of data || []) {
    let itemsCount = 0;
    try {
      const summary = JSON.parse(record.raw_materials_text);
      itemsCount = summary.items ? summary.items.length : 0;
    } catch {}

    console.log(`Auction: ${record.mstc_auction_number}`);
    console.log(`  Status: ${record.asset_status}`);
    console.log(`  Start:  ${record.opening_date}`);
    console.log(`  Close:  ${record.closing_date}`);
    console.log(`  Items:  ${itemsCount}`);
    console.log('-----------------------------------');
  }
}

run();
