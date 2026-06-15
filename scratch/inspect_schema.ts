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
    .ilike('mstc_auction_number', '%13932%')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (data && data.length > 0) {
    const row = data[0];
    console.log('Columns:', Object.keys(row));
    console.log('Auction Number:', row.mstc_auction_number);
    console.log('Asset Status:', row.asset_status);
    console.log('Raw Materials Text:', row.raw_materials_text?.slice(0, 500));
    console.log('Item List (preview_image_url):', row.preview_image_url);
    console.log('Metadata:', JSON.stringify(row.items, null, 2));
  } else {
    console.log('No auction found for 13932');
  }
}

run().catch(console.error);
