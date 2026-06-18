import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listAuctions() {
  const { data: auctions, error } = await supabase
    .from("mstc_auctions")
    .select("mstc_auction_number, seller_name, category_name, location")
    .limit(50);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`TOTAL AUCTIONS FETCHED: ${auctions?.length}`);
  auctions?.forEach(a => {
    console.log(`- Num: "${a.mstc_auction_number}" | Seller: "${a.seller_name}"`);
  });
}

listAuctions();
