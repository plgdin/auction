import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function find() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('mstc_auction_number, raw_materials_text')
    .ilike('raw_materials_text', '%TATA SUMO%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No Sumo record found');
    return;
  }

  console.log('Found', data.length, 'records');
  for (const record of data) {
    console.log('Auction:', record.mstc_auction_number);
    console.log('Items:', JSON.stringify(JSON.parse(record.raw_materials_text || '{}').items, null, 2));
  }
}

find().catch(console.error);
