import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: cols, error: colError } = await supabase
    .from('mstc_auctions')
    .select('*')
    .limit(1);

  if (colError) {
    console.error('Error fetching columns:', colError);
    return;
  }

  console.log('Columns in mstc_auctions:', Object.keys(cols[0] || {}));

  // Fetch count of items with different flags
  const { count: total, error: errTotal } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true });

  const { count: hasImages, error: errImages } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true })
    .eq('has_images', true);

  const { count: hasDocs, error: errDocs } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true })
    .eq('has_docs', true);

  const { count: isReauction, error: errRe } = await supabase
    .from('mstc_auctions')
    .select('*', { count: 'exact', head: true })
    .eq('is_reauction', true);

  console.log(`Total rows: ${total}`);
  console.log(`has_images = true: ${hasImages} (error: ${errImages?.message})`);
  console.log(`has_docs = true: ${hasDocs} (error: ${errDocs?.message})`);
  console.log(`is_reauction = true: ${isReauction} (error: ${errRe?.message})`);
}

run();
