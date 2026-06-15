import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDetails() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, raw_materials_text')
    .not('raw_materials_text', 'is', null)
    .limit(3);

  if (error) {
    console.error('Error fetching auctions:', error.message);
    return;
  }

  console.log('\n--- Raw Materials Text JSON Sample ---');
  data.forEach((row: any) => {
    console.log(`Number: ${row.mstc_auction_number}`);
    console.log(`JSON: ${row.raw_materials_text}\n`);
  });
}

checkDetails();
