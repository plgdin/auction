import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listAuctions() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, category_name, seller_name, raw_materials_text')
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  for (const r of records || []) {
    console.log(`\n========================================`);
    console.log(`ID: ${r.id}`);
    console.log(`Num: ${r.mstc_auction_number}`);
    console.log(`Cat: ${r.category_name}`);
    console.log(`Seller: ${r.seller_name}`);
    try {
      const parsed = JSON.parse(r.raw_materials_text);
      console.log(`Items count: ${parsed?.items?.length || 0}`);
      console.log(`First item:`, parsed?.items?.[0]);
    } catch {
      console.log(`Raw text:`, r.raw_materials_text.substring(0, 100));
    }
  }
}

listAuctions();
