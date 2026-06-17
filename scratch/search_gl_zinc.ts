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
    console.error('Error:', error);
    return;
  }

  for (const item of data || []) {
    const rawText = item.raw_materials_text || '';
    if (
      rawText.toLowerCase().includes(' gl ') ||
      rawText.toLowerCase().includes('gl ') ||
      rawText.toLowerCase().includes('zinc') ||
      rawText.toLowerCase().includes('aluminum') ||
      rawText.toLowerCase().includes('aluminium') ||
      item.mstc_auction_number.includes('7991')
    ) {
      console.log('====================================================');
      console.log(`Auction No: ${item.mstc_auction_number}`);
      console.log(`Seller: ${item.seller_name}`);
      try {
        const parsed = JSON.parse(rawText);
        const itemsList = parsed.items || [];
        const totalVal = calculateTotalMarketValue(itemsList, item.category_name);
        console.log(`Total Market Value (calculated): ₹${totalVal.toLocaleString()}`);
        console.log(`Items:`, JSON.stringify(itemsList, null, 2));
      } catch (e) {
        console.log('JSON parse error');
      }
    }
  }
}

main().catch(console.error);
