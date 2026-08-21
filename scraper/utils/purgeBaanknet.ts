/**
 * Utility script to purge all BaankNet auctions and photos from Supabase.
 * Run with: npx tsx scraper/utils/purgeBaanknet.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function purge() {
  console.log("🗑️  Purging all BaankNet auction photos...");
  const { error: photosErr } = await supabase
    .from("baanknet_auction_photos")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

  if (photosErr) {
    console.error("  Photos delete error:", photosErr.message);
  } else {
    console.log("  ✅ Photos purged.");
  }

  console.log("🗑️  Purging all BaankNet auctions...");
  const { error: auctionsErr, count } = await supabase
    .from("baanknet_auctions")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

  if (auctionsErr) {
    console.error("  Auctions delete error:", auctionsErr.message);
  } else {
    console.log(`  ✅ ${count ?? "All"} BaankNet auctions purged.`);
  }

  console.log("\n🎉 Done. You can now re-run the scraper:");
  console.log("   npx tsx scraper/baanknetScraper.ts");
}

purge().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
