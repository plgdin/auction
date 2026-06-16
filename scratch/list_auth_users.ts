import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error("auth users query error:", error);
  } else {
    console.log("Auth users list:");
    for (const u of users || []) {
      console.log(`ID: ${u.id} | Email: ${u.email}`);
    }
  }
}

run().catch(console.error);
