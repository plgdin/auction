import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('*')
    .ilike('mstc_auction_number', '%10013%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No record found matching %10013%');
    return;
  }

  const record = data[0];
  console.log('Auction Number:', record.mstc_auction_number);
  console.log('Status:', record.asset_status);
  console.log('Raw Materials Text JSON:', JSON.stringify(JSON.parse(record.raw_materials_text || '{}'), null, 2));
}

inspect().catch(console.error);
