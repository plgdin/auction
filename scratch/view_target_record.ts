import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function viewRecord() {
  const { data: records } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, source_pdf_url')
    .ilike('mstc_auction_number', '%BIHAR MILITARY POLICE (9)%')
    .limit(1);

  if (records && records.length > 0) {
    console.log(JSON.stringify(records[0], null, 2));
  } else {
    console.log('Record not found.');
  }
}

viewRecord().catch(console.error);
