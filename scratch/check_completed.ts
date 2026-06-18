import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkCompleted() {
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, raw_materials_text")
    .eq("mstc_auction_number", "MSTC/ERO/3 SIG BN CRPF/8/SALT LAKE/26-27/15686")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`FOUND CRPF AUCTION 15686:`);
  console.log(`- Num: "${data.mstc_auction_number}"`);
  try {
    const parsed = JSON.parse(data.raw_materials_text || "{}");
    console.log(`  Items count:`, parsed.items?.length);
    if (parsed.items) {
      parsed.items.forEach((it: any) => {
        console.log(`    * Lot ${it.sr}: "${it.description}" | Qty: ${it.qty} ${it.unit} | SubItems count:`, it.subItems?.length || 0);
        if (it.subItems) {
          it.subItems.forEach((sub: any) => {
            console.log(`      - SubSl ${sub.sr}: "${sub.description}" | Qty: ${sub.qty} ${sub.unit}`);
          });
        }
      });
    }
  } catch (e) {
    console.log(`  Invalid JSON in raw_materials_text:`, data.raw_materials_text ? data.raw_materials_text.substring(0, 500) : "null");
  }
}

checkCompleted();
