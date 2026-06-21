import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { processRecord, QueueRecord } from "../scraper/assetWorker.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Looking for auction 15641...");
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text, updated_at")
    .ilike("mstc_auction_number", "%15641%")
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error("Could not find auction 15641.", error);
    return;
  }

  const record = data[0] as QueueRecord;
  console.log(`Found auction: ${record.mstc_auction_number}`);
  console.log("Forcing document processing through Gemini Vision LLM...");

  try {
    await processRecord(record);
    console.log("Success! Auction 15641 has been parsed and updated in the database.");
  } catch (e: any) {
    console.error("Error processing record:", e.message);
  }
}

run();
