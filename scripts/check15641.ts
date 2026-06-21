import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("raw_materials_text")
    .ilike("mstc_auction_number", "%15641%")
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error("Could not find auction 15641.", error);
    return;
  }

  fs.writeFileSync('scratch/db.json', data[0].raw_materials_text);
  console.log("Wrote DB content to scratch/db.json");
}

run();
