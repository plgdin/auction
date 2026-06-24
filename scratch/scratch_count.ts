import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { count, error } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true })
    .eq('asset_status', 'completed');

  if (error) {
    console.error('Error counting completed:', error);
  } else {
    console.log('Total completed auctions count:', count);
  }
}

run();
