import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('--- Checking Supabase Storage ---');
  const { data, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.log('❌ Error fetching buckets:', error.message);
  } else {
    console.log('✅ Successfully fetched buckets list.');
    const bucketNames = data.map(b => b.name);
    console.log('Found Buckets:', bucketNames.join(', '));
    
    if (bucketNames.includes('auction-assets')) {
      console.log('\n✅ CRITICAL SUCCESS: The required "auction-assets" bucket EXISTS.');
    } else {
      console.log('\n❌ CRITICAL FAILURE: The required "auction-assets" bucket DOES NOT EXIST.');
    }
  }
}

checkStorage();
