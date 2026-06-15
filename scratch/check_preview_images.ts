import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .update({ asset_status: 'pending', retry_count: 0 })
    .ilike('mstc_auction_number', '%8714%')
    .select('id, mstc_auction_number');

  if (error) {
    console.error('Error updating auction:', error);
    return;
  }

  console.log('Updated records:', data);
}

run().catch(console.error);
