import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('category_name')
    .eq('asset_status', 'completed');

  if (error) {
    console.error('Error fetching categories:', error.message);
    return;
  }

  const uniqueCategories = Array.from(new Set(data.map((r: any) => r.category_name)));
  console.log('Unique category names:', uniqueCategories);
}

run();
