import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listCategories() {
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('category_name')
    .limit(100);

  if (error || !records) {
    console.error('Error fetching categories:', error?.message);
    return;
  }

  const counts: Record<string, number> = {};
  for (const r of records) {
    if (r.category_name) {
      counts[r.category_name] = (counts[r.category_name] || 0) + 1;
    }
  }

  console.log('Top Categories in Database:');
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted.slice(0, 30)) {
    console.log(`- ${cat} (${count})`);
  }
}

listCategories().catch(err => console.error(err));
