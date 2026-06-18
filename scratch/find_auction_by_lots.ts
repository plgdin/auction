import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, raw_materials_text, asset_status, sanitized_document_path")
    .or("raw_materials_text.ilike.%MT Burnt oil%,raw_materials_text.ilike.%General non Electrical%,raw_materials_text.ilike.%Electrical & Electronics%");

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`FOUND ${data?.length} MATCHING AUCTIONS:`);
  for (const item of data || []) {
    console.log(`- Num: "${item.mstc_auction_number}"`);
    console.log(`  Status: "${item.asset_status}"`);
    console.log(`  PDF Path:`, item.sanitized_document_path);
  }
}

main();
