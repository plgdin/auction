import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AUCTION_NUM = "MSTC/NRO/ESD DELHI CANTT/3/DELHI CANTT/26-27/15065";

async function main() {
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, asset_status, retry_count")
    .eq("mstc_auction_number", AUCTION_NUM)
    .single();

  if (error || !record) {
    console.error("Error finding auction:", error || "Not found");
    return;
  }

  console.log("Found auction:", record);

  console.log("Resetting status to 'pending' and retry_count to 0...");
  const { error: updateError } = await supabase
    .from("mstc_auctions")
    .update({
      asset_status: "pending",
      retry_count: 0,
      error_log: null
    })
    .eq("id", record.id);

  if (updateError) {
    console.error("Error updating auction:", updateError);
    return;
  }

  console.log("Success! Auction reset to pending. The worker will pick it up and re-parse it with the updated code.");
}

main();
