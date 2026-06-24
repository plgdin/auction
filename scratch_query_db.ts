import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Querying Ref: 58132...');
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, raw_materials_text, opening_date, closing_date, asset_status')
    .like('mstc_auction_number', '%58132');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Record found:', data[0]);
    try {
      const parsed = JSON.parse(data[0].raw_materials_text);
      console.log('Parsed JSON:', JSON.stringify(parsed, null, 2).substring(0, 1500));
    } catch (e) {
      console.log('raw_materials_text is not JSON:', data[0].raw_materials_text);
    }
  } else {
    console.log('No record found for 58132.');
  }
}

run();
