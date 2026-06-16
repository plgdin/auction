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
    .select('id, mstc_auction_number, category_name, raw_materials_text')
    .eq('asset_status', 'completed');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter for End of Life Vehicles
  const elv = data.filter((item: any) => item.category_name?.toLowerCase().includes('end of life vehicles'));
  console.log(`Total ELV in DB: ${elv.length}`);

  // Calculate preBid for each
  const counts: Record<number, number> = {};
  elv.forEach((item: any) => {
    let preBid = 50000;
    const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
    const shortIdNum = parseInt(shortId, 10);
    if (!isNaN(shortIdNum)) {
      if (shortIdNum % 4 === 0) preBid = 100000;
      else if (shortIdNum % 4 === 1) preBid = 25000;
      else if (shortIdNum % 4 === 2) preBid = 150000;
      else preBid = 50000;
    }
    counts[preBid] = (counts[preBid] || 0) + 1;
  });

  console.log('Pre-bid distribution:', counts);
}

run().catch(console.error);
