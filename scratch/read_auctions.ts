import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('mstc_auction_number, raw_materials_text');

  if (error) {
    console.error('Error fetching auctions:', error);
    return;
  }

  console.log('Total auctions:', data?.length);
  for (const row of data || []) {
    const text = (row.raw_materials_text || '');
    if (text.toLowerCase().includes('o-general') || text.toLowerCase().includes('general')) {
      console.log('Found "general" in Auction Number:', row.mstc_auction_number);
      // Let's print matches
      const matches = text.match(/[^\n\r]{0,50}(?:o-general|general)[^\n\r]{0,50}/ig);
      console.log('Matches:', matches);
      console.log('----------------------------------------------------');
    }
  }
}

test();
