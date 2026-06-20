import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";
import { processRecord, QueueRecord } from "../scraper/assetWorker.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AUCTION_NUM = "MSTC/NRO/ESD DELHI CANTT/3/DELHI CANTT/26-27/15065";

async function main() {
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text")
    .eq("mstc_auction_number", AUCTION_NUM)
    .single();

  if (error || !record) {
    console.error("Error finding auction:", error || "Not found");
    return;
  }

  console.log("Reprocessing auction directly...", record.mstc_auction_number);

  try {
    await processRecord(record as QueueRecord);
    console.log("Successfully reprocessed and updated the record!");
  } catch (err: any) {
    console.error("Reprocessing failed:", err);
  }
}

main();
