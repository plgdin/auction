/**
 * CLI Tool: Clear / Delete GeM Forward Auctions
 *
 * Usage:
 *   npx tsx scraper/clearGemAuctions.ts --all            # Delete all GeM forward auctions
 *   npx tsx scraper/clearGemAuctions.ts --expired        # Delete only expired / closed auctions
 *   npx tsx scraper/clearGemAuctions.ts --before 2026-09-01 # Delete auctions ending before date
 *
 * Can also be run via:
 *   npm run gem:clear
 *   npm run gem:clear:expired
 */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config.js";
import { logger } from "./utils/logger.js";

const log = logger.child({ module: "clearGemAuctions" });

async function main() {
  const args = process.argv.slice(2);
  const isExpiredOnly = args.includes("--expired") || args.includes("--expired-only");
  const beforeIdx = args.indexOf("--before");
  const beforeDate = beforeIdx !== -1 ? args[beforeIdx + 1] : null;
  const isAll = args.includes("--all") || (!isExpiredOnly && !beforeDate);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment (.env / .env.local).");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("\n=======================================================");
  console.log(" 🗑️   GeM Forward Auctions Database Clean Tool");
  console.log("=======================================================\n");

  if (isExpiredOnly) {
    console.log("Target: Expired / Closed auctions (auction_end_date < NOW())");
  } else if (beforeDate) {
    console.log(`Target: Auctions ending before: ${beforeDate}`);
  } else {
    console.log("Target: ALL GeM forward auctions & associated bids");
  }

  try {
    // 1. Check current count in gem_auctions
    let queryCount = supabase.from("gem_auctions").select("id, gem_auction_id, auction_end_date", { count: "exact" });
    if (isExpiredOnly) {
      queryCount = queryCount.lt("auction_end_date", new Date().toISOString());
    } else if (beforeDate) {
      queryCount = queryCount.lt("auction_end_date", new Date(beforeDate).toISOString());
    }

    const { count: totalFound, error: countErr } = await queryCount;
    if (countErr) {
      console.error("❌ Failed to query gem_auctions table:", countErr.message);
      process.exit(1);
    }

    console.log(`📊 Found ${totalFound || 0} GeM auction record(s) matching criteria.\n`);

    if (!totalFound || totalFound === 0) {
      console.log("✅ No matching records to delete. Database is already clean.");
      process.exit(0);
    }

    // 2. Delete child bids first if deleting all
    if (isAll) {
      console.log("⏳ Deleting child bid records from 'gem_bids'...");
      const { count: bidsDeleted, error: bidsErr } = await supabase
        .from("gem_bids")
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (bidsErr) {
        log.warn({ err: bidsErr.message }, "Warning while clearing gem_bids (may not exist or have records)");
      } else {
        console.log(`   Deleted ${bidsDeleted || 0} bid record(s).`);
      }
    }

    // 3. Delete matching auctions
    console.log("⏳ Deleting records from 'gem_auctions'...");
    let deleteQuery = supabase.from("gem_auctions").delete({ count: "exact" });

    if (isExpiredOnly) {
      deleteQuery = deleteQuery.lt("auction_end_date", new Date().toISOString());
    } else if (beforeDate) {
      deleteQuery = deleteQuery.lt("auction_end_date", new Date(beforeDate).toISOString());
    } else {
      deleteQuery = deleteQuery.neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { count: auctionsDeleted, error: delErr } = await deleteQuery;

    if (delErr) {
      console.error("❌ Failed to delete from gem_auctions:", delErr.message);
      process.exit(1);
    }

    console.log(`\n🎉 Successfully deleted ${auctionsDeleted || 0} GeM auction record(s).`);
    console.log("=======================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Unexpected error:", err.message);
    process.exit(1);
  }
}

main();
