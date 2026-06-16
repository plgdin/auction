import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error("profiles query error:", error);
  } else {
    console.log("Profiles first row keys:", data && data[0] ? Object.keys(data[0]) : "Empty profiles table");
    console.log("Profiles records:", data);
  }
}

run().catch(console.error);
