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
    .select('*')
    .eq('mstc_auction_number', 'MSTC/ERO/INDUS TOWERS LIMITED/8/Patna/26-27/15016');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
