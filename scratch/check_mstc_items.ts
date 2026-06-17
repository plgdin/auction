import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

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
    const upperText = rawText.toUpperCase();
    if (upperText.includes('MS SCRAP') || item.mstc_auction_number.includes('7991')) {
      console.log('====================================================');
      console.log(`Auction No: ${item.mstc_auction_number}`);
      console.log(`Seller: ${item.seller_name}`);
      console.log(`Location: ${item.location}`);
      try {
        const parsed = JSON.parse(rawText);
        console.log(`Parsed items:`, JSON.stringify(parsed.items, null, 2));
      } catch (e) {
        console.log('Failed to parse JSON:', rawText);
      }
    }
  }
}

main().catch(console.error);
