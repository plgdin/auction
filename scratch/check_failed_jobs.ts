import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AUCTION_NUM = "MSTC/NRO/ESD DELHI CANTT/3/DELHI CANTT/26-27/15065";

async function main() {
  const { data: record, error } = await supabase
    .from("mstc_auctions")
    .select("raw_materials_text")
    .eq("mstc_auction_number", AUCTION_NUM)
    .single();

  if (error || !record) {
    console.error("Error:", error);
    return;
  }

  const parsed = JSON.parse(record.raw_materials_text);
  console.log("Parsed items:");
  console.log(JSON.stringify(parsed.items, null, 2));
}

main();
