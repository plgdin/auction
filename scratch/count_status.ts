import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('asset_status');

  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const status = row.asset_status || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
  }

  console.log('Current status counts:');
  console.log(JSON.stringify(counts, null, 2));
}

run().catch(console.error);
