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
    const lowerText = rawText.toLowerCase();
    
    // Check if it contains gl, zinc, aluminum, or is from the EOW Chennai auction (9777-9793)
    const hasGL = lowerText.includes(' gl ') || lowerText.includes(' gl,') || lowerText.includes(' gl/');
    const hasZinc = lowerText.includes('zinc');
    const hasAl = lowerText.includes('aluminum') || lowerText.includes('aluminium') || lowerText.includes(' al ');
    
    if (hasGL || hasZinc || hasAl) {
      try {
        const parsed = JSON.parse(rawText);
        const itemsList = parsed.items || [];
        const totalVal = calculateTotalMarketValue(itemsList, item.category_name);
        
        console.log('----------------------------------------------------');
        console.log(`Auction No: ${item.mstc_auction_number}`);
        console.log(`Seller: ${item.seller_name}`);
        console.log(`Total Value: ₹${totalVal.toLocaleString()}`);
        console.log(`Items count: ${itemsList.length}`);
        
        // Print items that might contain gl, zinc, al
        const matchedItems = itemsList.filter((lot: any) => {
          const desc = (lot.description || '').toLowerCase();
          return desc.includes('gl') || desc.includes('zinc') || desc.includes('al') || desc.includes('aluminum') || desc.includes('aluminium');
        });
        console.log(`Matched Items:`, JSON.stringify(matchedItems, null, 2));
      } catch (e) {
        // ignore
      }
    }
  }
}

main().catch(console.error);
