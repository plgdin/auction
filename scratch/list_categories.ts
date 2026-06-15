import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listCategories() {
  console.log('Fetching unique values from database...');
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('category_name, location, seller_name');

  if (error) {
    console.error('Error fetching data:', error.message);
    return;
  }

  const categories = new Set<string>();
  const locations = new Set<string>();
  const sellers = new Set<string>();

  data?.forEach(row => {
    if (row.category_name) categories.add(row.category_name);
    if (row.location) locations.add(row.location);
    if (row.seller_name) sellers.add(row.seller_name);
  });

  console.log(`\n--- Categories (${categories.size}) ---`);
  Array.from(categories).sort().forEach(c => console.log(` - ${c}`));

  console.log(`\n--- Locations (${locations.size}) ---`);
  Array.from(locations).sort().forEach(l => console.log(` - ${l}`));

  console.log(`\n--- Sellers (${sellers.size}) ---`);
  Array.from(sellers).sort().slice(0, 50).forEach(s => console.log(` - ${s}`));
  if (sellers.size > 50) {
    console.log(` ... and ${sellers.size - 50} more`);
  }
}

listCategories();
