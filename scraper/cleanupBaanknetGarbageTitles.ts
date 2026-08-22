/**
 * Cleanup script to fix "Showing 10000+ Results" and bank name location artifacts
 * in existing BaankNet database records.
 *
 * Usage:
 *   npx tsx scraper/cleanupBaanknetGarbageTitles.ts           # Dry run
 *   npx tsx scraper/cleanupBaanknetGarbageTitles.ts --apply   # Apply to database
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const isDryRun = !process.argv.includes("--apply");

function isGarbageTitle(title?: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  return (
    lower.startsWith("showing") ||
    lower.includes("10000+") ||
    lower.includes("results found") ||
    lower.includes("properties found") ||
    lower.includes("search results") ||
    lower === "bank auction property"
  );
}

function isBankName(val?: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  return (
    lower.includes("bank") ||
    lower.includes("lender") ||
    lower.includes("showing") ||
    lower.includes("results")
  );
}

async function runCleanup() {
  console.log(`[BaankNet Cleanup] Mode: ${isDryRun ? "DRY RUN (preview only)" : "APPLYING CHANGES"}`);

  const { data: records, error } = await supabase
    .from("baanknet_auctions")
    .select("id, baanknet_auction_id, title, property_type, carpet_area, city, state, location, full_address, bank_name");

  if (error) {
    console.error("Database query failed:", error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log("No BaankNet records found.");
    return;
  }

  console.log(`Auditing ${records.length} BaankNet records...`);
  let fixedCount = 0;

  for (const record of records) {
    let changed = false;
    const updates: Record<string, any> = {};

    // 1. Check IBC title & metadata concatenation
    if (record.title && (record.title.includes("Asset Classification") || record.title.includes("IP Name") || record.title.includes("Asset ID"))) {
      const rawText = record.title;
      const classMatch = rawText.match(/Asset\s*Classification\s*([A-Za-z0-9\s&,/-]+?)(?=Fixed|Asset|Location|IP|Reserve|EMD|Contact|$)/i);
      const locMatch = rawText.match(/(?:Fixed\s*Asset\s*Location|Asset\s*Location|Location)\s*([A-Za-z0-9\s&,/-]+?)(?=IP|Liquidator|Reserve|EMD|Contact|Classification|$)/i);
      const ipMatch = rawText.match(/(?:IP\s*Name|Liquidator\s*Name|Liquidator|RP\s*Name|IP)\s*:?\s*([A-Za-z0-9\s.,-]+?)(?=Contact|Email|Phone|Reserve|EMD|Price|Asset|$)/i);

      const classification = classMatch ? classMatch[1].replace(/Contact\s*Us/i, "").trim() : (record.property_type || "Insolvency Asset");
      const locStr = locMatch ? locMatch[1].replace(/Contact\s*Us/i, "").trim() : "";
      const ipName = ipMatch ? ipMatch[1].replace(/Contact\s*Us/i, "").trim() : "";

      updates.title = locStr ? `${classification} in ${locStr}` : classification;
      updates.property_type = classification;
      if (locStr) {
        updates.full_address = locStr;
        const parts = locStr.split(/[,–-]/).map((p: string) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          updates.state = parts[0];
          updates.city = parts[1];
          updates.location = parts[0];
        } else if (parts.length === 1) {
          updates.state = parts[0];
          updates.location = parts[0];
        }
      }
      if (ipName) {
        updates.contact_person = ipName;
        updates.officer_designation = "Insolvency Professional / Liquidator";
      }

      // Check if auction ID is concatenated like "4523Asset"
      const numMatch = record.baanknet_auction_id?.match(/\d+/);
      if (numMatch && record.baanknet_auction_id !== numMatch[0]) {
        updates.baanknet_auction_id = numMatch[0];
        updates.bank_property_id = numMatch[0];
      }

      changed = true;
    } else if (isGarbageTitle(record.title)) {
      const area = record.carpet_area ? `${record.carpet_area} ` : "";
      const pType = record.property_type && record.property_type !== "Bank Foreclosure Property"
        ? record.property_type
        : "Bank Foreclosure Property";
      const validCity = !isBankName(record.city) ? record.city : "";
      const validState = !isBankName(record.state) ? record.state : (!isBankName(record.location) ? record.location : "");
      const locSuffix = validCity ? ` in ${validCity}` : (validState ? ` in ${validState}` : "");
      
      updates.title = `${area}${pType}${locSuffix}`.trim() || "Bank Foreclosure Property";
      changed = true;
    }

    // 2. Check location / state / city
    if (isBankName(record.state)) {
      updates.state = null;
      changed = true;
    }
    if (isBankName(record.city)) {
      updates.city = null;
      changed = true;
    }
    if (isBankName(record.location)) {
      updates.location = "India";
      changed = true;
    }

    if (changed) {
      fixedCount++;
      console.log(`  [Fixed ID ${record.baanknet_auction_id}]`);
      if (updates.title) console.log(`    Title: "${record.title}" -> "${updates.title}"`);
      if (updates.state !== undefined) console.log(`    State: "${record.state}" -> null`);
      if (updates.city !== undefined) console.log(`    City: "${record.city}" -> null`);
      if (updates.location !== undefined) console.log(`    Location: "${record.location}" -> "India"`);

      if (!isDryRun) {
        const { error: updateErr } = await supabase
          .from("baanknet_auctions")
          .update(updates)
          .eq("id", record.id);
        if (updateErr) {
          console.error(`    ERROR updating ${record.baanknet_auction_id}:`, updateErr.message);
        }
      }
    }
  }

  console.log(`[BaankNet Cleanup] Completed. ${fixedCount} of ${records.length} records ${isDryRun ? "need fixing" : "successfully updated"}.`);
}

runCleanup().catch(console.error);
