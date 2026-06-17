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
    console.error('Error:', error);
    return;
  }

  for (const item of data || []) {
    const textToSearch = JSON.stringify(item).toLowerCase();
    if (textToSearch.includes('begusarai')) {
      console.log('Found Begusarai in auction:', item.mstc_auction_number);
      console.log('Location:', item.location);
      console.log('Seller:', item.seller_name);
      console.log('Raw Materials Text:', item.raw_materials_text);
    }
  }
}

main().catch(console.error);
