import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";
import { processRecord, QueueRecord } from "../scraper/assetWorker.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RECORD_ID = "805b9273-5e69-4995-bd8b-072ddad25762";

async function main() {
  console.log(`Fetching database record for ID: ${RECORD_ID}...`);
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text")
    .eq("id", RECORD_ID)
    .single();

  if (error || !record) {
    console.error("Error finding auction record:", error || "Not found");
    return;
  }

  console.log("Reprocessing auction directly:", record.mstc_auction_number);

  try {
    await processRecord(record as QueueRecord);
    console.log("Successfully reprocessed and updated the record in Supabase!");
  } catch (err: any) {
    console.error("Reprocessing failed:", err);
  }
}

main();
