import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { calculateTotalMarketValue } from '../src/utils/valuationUtils';
import { generateCatalogSummary } from '../src/utils/mstcHelpers';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const item of data || []) {
    const summary = generateCatalogSummary(item);
    const totalVal = calculateTotalMarketValue(summary.items, item.category_name);
    console.log(`Auction ${item.mstc_auction_number.split('/').pop()}: ₹${totalVal.toLocaleString()} (${item.seller_name} - ${item.location})`);
  }
}

main().catch(console.error);
