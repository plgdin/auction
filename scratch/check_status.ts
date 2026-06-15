import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
  console.log('Querying asset processing statuses in mstc_auctions...');
  
  const { data, error } = await supabase
    .from('mstc_auctions')
    .select('asset_status, count')
    .select('asset_status');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  const counts: Record<string, number> = {};
  data.forEach((row: any) => {
    const status = row.asset_status || 'null';
    counts[status] = (counts[status] || 0) + 1;
  });

  console.log('\nStatus Summary:');
  console.log(JSON.stringify(counts, null, 2));
}

checkStatus().catch(console.error);
