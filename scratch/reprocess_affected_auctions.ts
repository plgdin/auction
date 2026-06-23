import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";
import { processRecord, QueueRecord } from "../scraper/assetWorker.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AFFECTED_IDS = [
  "9d18b174-acbd-4e39-899f-463d2452490b",
  "d7a27d8d-9acb-4b07-9015-7b3cf2e4cd0a",
  "bc43aff1-3980-44dc-aecb-1ff7dff9d65b",
  "465a9e8c-f9d0-4e42-baec-37f7dec3f693",
  "6edaebe2-ca0e-41b6-9da3-a0ff229d5253"
];

async function main() {
  console.log(`Starting reprocessing for ${AFFECTED_IDS.length} affected auctions...`);
  
  for (let i = 0; i < AFFECTED_IDS.length; i++) {
    const id = AFFECTED_IDS[i];
    console.log(`\n[${i+1}/${AFFECTED_IDS.length}] Fetching record for ID: ${id}...`);
    
    const { data: record, error } = await supabase
      .from("mstc_auctions")
      .select("id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text")
      .eq("id", id)
      .single();

    if (error || !record) {
      console.error(`Error finding record for ID ${id}:`, error || "Not found");
      continue;
    }

    console.log(`Reprocessing: ${record.mstc_auction_number}`);
    try {
      await processRecord(record as QueueRecord);
      console.log(`Successfully reprocessed and updated record: ${record.mstc_auction_number}`);
    } catch (err: any) {
      console.error(`Reprocessing failed for ${record.mstc_auction_number}:`, err);
    }
  }
  
  console.log("\nAll affected auctions reprocessed successfully!");
}

main().catch(console.error);
