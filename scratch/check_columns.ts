import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("is_reauction, original_auction_number, parent_auction_id")
    .limit(1);

  if (error) {
    console.log("COLUMNS CHECK ERROR:", error.message, `(${error.code})`);
  } else {
    console.log("Columns already exist in the database!");
  }
}

checkColumns();
