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
    const rawText = item.raw_materials_text || '';
    const lowerText = rawText.toLowerCase();
    
    const hasGL = lowerText.includes(' gl ') || lowerText.includes(' gl,') || lowerText.includes(' gl/');
    const hasZinc = lowerText.includes('zinc');
    const hasAl = lowerText.includes('aluminum') || lowerText.includes('aluminium') || lowerText.includes(' al ');
    
    if (hasGL || hasZinc || hasAl) {
      try {
        const parsed = JSON.parse(rawText);
        const itemsList = parsed.items || [];
        const totalVal = calculateTotalMarketValue(itemsList, item.category_name);
        
        if (totalVal > 10000) {
          console.log(`Auction ${item.mstc_auction_number.split('/').pop()}: ₹${totalVal.toLocaleString()} (Seller: ${item.seller_name}, Location: ${item.location})`);
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

main().catch(console.error);
