import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Resetting all completed auctions to pending for reprocessing...');
  
  const { data, error } = await supabase
    .from('mstc_auctions')
    .update({ asset_status: 'pending', retry_count: 0 })
    .eq('asset_status', 'completed')
    .select('id');

  if (error) {
    console.error('Error updating records:', error);
    return;
  }

  console.log(`Successfully reset ${data?.length || 0} completed records to pending. Please run:`);
  console.log('  npm run worker');
  console.log('to start the background worker and generate preview images.');
}

run().catch(console.error);
