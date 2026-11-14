// Automated background auction & escrow worker daemon for Lelam.
// Runs run_maintenance() continuously or as a single-pass CLI command.
//
// Usage:
//   npx tsx scripts/auction-worker.ts         # runs daemon every 10 seconds
//   npx tsx scripts/auction-worker.ts --once  # single maintenance sweep
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isOnce = process.argv.includes("--once");
const intervalSec = Number(process.env.AUCTION_WORKER_INTERVAL_SEC || 10);

async function sweep() {
  const ts = new Date().toISOString();
  try {
    const { data, error } = await client.rpc("run_maintenance");
    if (error) {
      console.error(`[${ts}] Worker Error:`, error.message);
      return;
    }
    const {
      auctionsStarted = 0,
      auctionsClosed = 0,
      expiredOrders = 0,
      expiredAuctions = 0,
      expiredSecondChance = 0,
      escrowReleased = 0,
    } = data || {};

    const hasActivity =
      auctionsStarted > 0 ||
      auctionsClosed > 0 ||
      expiredOrders > 0 ||
      expiredAuctions > 0 ||
      expiredSecondChance > 0 ||
      escrowReleased > 0;

    if (hasActivity || isOnce) {
      console.log(
        `[${ts}] Sweep: started=${auctionsStarted} closed=${auctionsClosed} expiredAuctions=${expiredAuctions} secondChance=${expiredSecondChance} escrowReleased=${escrowReleased}`,
      );
    }
  } catch (err: unknown) {
    console.error(`[${ts}] Execution Exception:`, err);
  }
}

async function main() {
  console.log(`[Auction Worker] Initialized (url: ${url}, mode: ${isOnce ? "single-pass" : `loop every ${intervalSec}s`})`);
  await sweep();
  if (isOnce) {
    process.exit(0);
  }

  setInterval(sweep, intervalSec * 1000);
}

main();
