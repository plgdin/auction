import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetAdminPassword() {
  const adminUserId = '26fbe5e9-f1ae-47de-ada7-2f2992c5ed41'; // ID of admin@auction.com
  const newPassword = 'AdminPassword123!';

  console.log(`Updating password for admin@auction.com (ID: ${adminUserId})...`);
  const { data, error } = await supabase.auth.admin.updateUserById(
    adminUserId,
    { password: newPassword }
  );

  if (error) {
    console.error('Failed to update admin password:', error.message);
    return;
  }

  console.log(`Password updated successfully!`);
  console.log(`Email: admin@auction.com`);
  console.log(`Password: ${newPassword}`);
}

resetAdminPassword().catch(console.error);
