import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const tablesToCheck = [
  'profiles',
  'organizations',
  'auction_categories',
  'auctions',
  'auction_documents',
  'auction_images',
  'bids',
  'watchlists',
  'tenders',
  'tender_documents',
  'tender_submissions',
  'emd_transactions',
  'payment_receipts',
  'wallet_transactions',
  'notifications',
  'audit_logs',
  'announcements',
  'faq_items',
  'news_updates',
  'contact_messages',
  'mstc_auctions'
];

async function checkDatabase() {
  console.log('--- Starting Database Schema Check ---');
  let allGood = true;

  for (const table of tablesToCheck) {
    // Attempt a simple select limit 1
    const { data, error } = await supabase.from(table).select('*').limit(1);

    if (error) {
      console.log(`\n❌ ERROR on table '${table}':`);
      console.log(error.message);
      allGood = false;
    } else {
      console.log(`✅ Table '${table}' exists and is accessible.`);
      // Check column keys if data exists
      if (data && data.length > 0) {
         // console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
      }
    }
  }

  console.log('\n--- Check Complete ---');
  if (allGood) {
    console.log('All required tables exist and are accessible!');
  } else {
    console.log('Some tables failed. Backend does not fully match frontend expectations.');
  }
}

checkDatabase();
