import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { getEstimatedMarketPrice, calculateTotalMarketValue } from '../src/utils/valuationUtils';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('*');

  if (error) {
    console.error('Error fetching auctions:', error);
    return;
  }

  for (const item of data || []) {
    const rawText = item.raw_materials_text || '';
    try {
      const parsed = JSON.parse(rawText);
      const itemsList = parsed.items || [];
      const totalVal = calculateTotalMarketValue(itemsList, item.category_name);
      
      const hasMsScrap = itemsList.some((lot: any) => 
        (lot.description || '').toLowerCase().includes('ms scrap')
      );
      
      if (hasMsScrap && totalVal > 1000000) {
        console.log('====================================================');
        console.log(`Auction No: ${item.mstc_auction_number}`);
        console.log(`Seller: ${item.seller_name}`);
        console.log(`Location: ${item.location}`);
        console.log(`Total Market Value (calculated): ₹${totalVal.toLocaleString()}`);
        console.log(`Items:`, JSON.stringify(itemsList, null, 2));
      }
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
