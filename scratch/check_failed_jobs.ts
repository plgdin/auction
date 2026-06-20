import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("asset_status, retry_count");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.asset_status] = (counts[row.asset_status] || 0) + 1;
  }
  console.log("Asset status counts:", counts);

  const failedRecords = data.filter(r => r.asset_status === 'failed');
  console.log("Failed records total count:", failedRecords.length);
  
  const pendingRecords = data.filter(r => r.asset_status === 'pending');
  console.log("Pending records total count:", pendingRecords.length);
}

main();
