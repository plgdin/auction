import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { processRecord } from "../scraper/assetWorker.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Fetching CRPF 15686 record...");
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text")
    .eq("mstc_auction_number", "MSTC/ERO/3 SIG BN CRPF/8/SALT LAKE/26-27/15686")
    .single();

  if (error || !record) {
    console.error("Failed to fetch record:", error?.message);
    return;
  }

  // Force asset_status to pending so we can process it
  await supabase.from("mstc_auctions").update({ asset_status: "pending" }).eq("id", record.id);

  console.log(`Processing CRPF record: "${record.mstc_auction_number}"...`);
  try {
    await processRecord(record);
    console.log("✅ Success! Check database or check_completed.ts output now.");
  } catch (err: any) {
    console.error("❌ Process record failed:", err.message);
  }
}

main().catch(console.error);
