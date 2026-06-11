import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listCategories() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('category_name, seller_name');

  if (error) {
    console.error('Error fetching categories:', error.message);
    return;
  }

  const categories = new Set(data.map(r => r.category_name));
  const sellers = new Set(data.map(r => r.seller_name));

  console.log('\n--- Unique Categories ---');
  console.log(Array.from(categories));
  console.log('\n--- Unique Sellers ---');
  console.log(Array.from(sellers));
}

listCategories();
