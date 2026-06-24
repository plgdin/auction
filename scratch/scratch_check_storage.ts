import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const testId = '4f8a5f1a-f687-49d9-b23f-9b147181f2c0'; // ONGC Vessel 11626 auction id
  
  console.log(`Checking storage for previews of ID: ${testId}...`);
  
  // List files in mstc-previews folder
  const { data: previews, error: previewErr } = await supabase.storage
    .from('auction_documents')
    .list('mstc-previews', {
      search: testId
    });

  if (previewErr) {
    console.error('Error listing previews:', previewErr);
  } else {
    console.log('Found previews:', previews);
  }

  // List files in mstc-extracted-images folder
  const { data: extracted, error: extErr } = await supabase.storage
    .from('auction_documents')
    .list('mstc-extracted-images', {
      search: testId
    });

  if (extErr) {
    console.error('Error listing extracted:', extErr);
  } else {
    console.log('Found extracted:', extracted);
  }
}

run();
