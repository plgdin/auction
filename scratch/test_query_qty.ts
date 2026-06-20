import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../scraper/config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLots() {
  const { data, error } = await supabase
    .from("mstc_auctions")
    .select("mstc_auction_number, raw_materials_text");

  if (error) {
    console.error("Error fetching auctions:", error);
    return;
  }

  console.log(`Fetched ${data.length} auctions. Checking sub-items for column flipping...`);

  let count = 0;
  for (const row of data) {
    if (!row.raw_materials_text) continue;
    try {
      const parsed = JSON.parse(row.raw_materials_text);
      if (parsed && parsed.items && Array.isArray(parsed.items)) {
        for (const item of parsed.items) {
          if (item.subItems && Array.isArray(item.subItems)) {
            for (const sub of item.subItems) {
              const subQtyVal = parseFloat(String(sub.qty).replace(/,/g, ""));
              const subSrVal = parseFloat(String(sub.sr).replace(/,/g, ""));
              
              if (!isNaN(subQtyVal) && !isNaN(subSrVal) && subSrVal > 20 && subQtyVal < 5) {
                count++;
                console.log(`[${count}] Potential flipped columns in sub-item of auction: ${row.mstc_auction_number}`);
                console.log(`  Parent Lot Sr: ${item.sr}`);
                console.log(`  Sub Sr (Parsed as Sr, likely Qty): ${sub.sr}`);
                console.log(`  Qty (Parsed as Qty, likely Sr): ${sub.qty}`);
                console.log(`  Unit: ${sub.unit} | Desc: ${sub.description}`);
                console.log("-----------------------------------------");
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

checkLots();
