import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findAnnexures() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, category_name, seller_name, raw_materials_text');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Searching through ${records?.length || 0} records...`);

  for (const r of records || []) {
    const text = r.raw_materials_text.toLowerCase();
    if (
      text.includes('annexure') ||
      text.includes('embedded') ||
      text.includes('as per list') ||
      text.includes('detailed list') ||
      text.includes('attached list') ||
      text.includes('click here') ||
      text.includes('details in')
    ) {
      console.log(`\nMatched Auction: ${r.mstc_auction_number}`);
      console.log(`Seller: ${r.seller_name}`);
      try {
        const parsed = JSON.parse(r.raw_materials_text);
        console.log(`Items:`, parsed.items);
      } catch {
        console.log(`Text preview: ${r.raw_materials_text.substring(0, 300)}`);
      }
    }
  }
}

findAnnexures();
