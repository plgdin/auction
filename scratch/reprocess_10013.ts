import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { runAssetPipelineQueue } from '../scraper/assetWorker.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Resetting auction 10013 to pending status...');
  const { error } = await supabase
    .from('mstc_auctions')
    .update({ asset_status: 'pending', retry_count: 0 })
    .ilike('mstc_auction_number', '%10013%');

  if (error) {
    console.error('Failed to reset record:', error);
    return;
  }

  console.log('Starting asset pipeline queue for the record...');
  await runAssetPipelineQueue();
  console.log('Run finished successfully.');
}

run().catch(console.error);
