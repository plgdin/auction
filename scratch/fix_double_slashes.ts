import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Fixing double slashes in database records...");

  let page = 0;
  const pageSize = 100;
  let hasMore = true;
  let totalFixed = 0;

  while (hasMore) {
    const { data: records, error } = await supabase
      .from("mstc_auctions")
      .select("id, mstc_auction_number, raw_materials_text")
      .eq("asset_status", "completed")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Fetch error:", error);
      break;
    }

    if (!records || records.length === 0) {
      hasMore = false;
      break;
    }

    const promises = records.map(async (record) => {
      if (record.raw_materials_text && record.raw_materials_text.includes("//storage/")) {
        const fixedText = record.raw_materials_text.replace(/\/\/storage\//g, "/storage/");
        
        const { error: updateError } = await supabase
          .from("mstc_auctions")
          .update({ raw_materials_text: fixedText })
          .eq("id", record.id);

        if (updateError) {
          console.error(`Failed to update ${record.mstc_auction_number}:`, updateError.message);
          return false;
        } else {
          return true;
        }
      }
      return false;
    });

    const results = await Promise.all(promises);
    const fixedInBatch = results.filter(Boolean).length;
    totalFixed += fixedInBatch;
    console.log(`Page ${page} processed. Fixed in batch: ${fixedInBatch}. Total fixed so far: ${totalFixed}`);

    if (records.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`Finished fixing double slashes. Total records updated: ${totalFixed}`);
}

run();
