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
  const userId = '26fbe5e9-f1ae-47de-ada7-2f2992c5ed41'; // admin@auction.com
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: 'Admin123!'
  });

  if (error) {
    console.error("Password update error:", error);
  } else {
    console.log("Password updated successfully for admin@auction.com!");
  }
}

run().catch(console.error);
