import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkDetails() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, seller_name, location, asset_status')
    .eq('asset_status', 'completed')
    .limit(10);

  if (error) {
    console.error('Error fetching auctions:', error.message);
    return;
  }

  console.log('\n--- Completed Items Details ---');
  data.forEach((row: any) => {
    console.log(`Number: ${row.mstc_auction_number}\n  Seller: ${row.seller_name}\n  Location: ${row.location}\n`);
  });
}

checkDetails();
