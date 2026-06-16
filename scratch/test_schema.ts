import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking mstc_auctions select * order by created_at...");
  const { data: aucData, error: aucError } = await supabase
    .from('mstc_auctions')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(1);

  if (aucError) {
    console.error("mstc_auctions error:", aucError);
  } else {
    console.log("mstc_auctions first row keys:", aucData && aucData[0] ? Object.keys(aucData[0]) : "Empty table");
    console.log("mstc_auctions row content:", aucData && aucData[0]);
  }

  console.log("Checking audit_logs select * with filter...");
  const { data: logData, error: logError } = await supabase
    .from('audit_logs')
    .select('*')
    .in('action', ['mstc_auction_downloaded', 'mstc_auction_deleted', 'mstc_auction_failed'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (logError) {
    console.error("audit_logs error:", logError);
  } else {
    console.log("audit_logs keys:", logData && logData[0] ? Object.keys(logData[0]) : "Empty table");
    console.log("audit_logs row content:", logData && logData[0]);
  }
}

run().catch(console.error);
