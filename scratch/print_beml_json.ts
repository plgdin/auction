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
    .select('*')
    .ilike('mstc_auction_number', '%13045%')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data?.[0], null, 2));
}
run();
