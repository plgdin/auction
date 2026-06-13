import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findAuction() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, seller_name, location, raw_materials_text')
    .eq('asset_status', 'completed');

  if (error) {
    console.error('Error fetching auctions:', error.message);
    return;
  }

  let output = '';
  data.forEach((row: any) => {
    if (row.raw_materials_text && row.raw_materials_text.includes('76')) {
      output += `ID: ${row.id}\n`;
      output += `Number: ${row.mstc_auction_number}\n`;
      output += `Text: ${row.raw_materials_text}\n`;
      output += '--------------------------------------------------\n\n';
    }
  });

  fs.writeFileSync('scratch/matching_items.txt', output);
  console.log('Saved to scratch/matching_items.txt');
}

findAuction();
