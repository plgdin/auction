import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkActive() {
  const now = new Date().toISOString();
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, category_name, seller_name, sanitized_document_path, raw_materials_text')
    .gt('closing_date', now);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${records?.length || 0} active auctions.`);
  for (const r of records || []) {
    console.log(`- ${r.mstc_auction_number} | Seller: ${r.seller_name}`);
  }
}

checkActive();
