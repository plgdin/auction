/**
 * One-time cleanup script to fix OCR garbage in existing auction descriptions.
 *
 * Queries all completed auctions, parses their catalog_summary JSON,
 * runs stripTrailingGarbage() on each item description, and updates
 * records that changed.
 *
 * Usage:
 *   npx tsx scraper/cleanupGarbageDescriptions.ts           # Dry run (preview only)
 *   npx tsx scraper/cleanupGarbageDescriptions.ts --apply   # Apply changes to database
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { cleanMaterialDescription } from "./parsers/lotParser.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const isDryRun = !process.argv.includes("--apply");

async function main() {
  console.log(
    `[Cleanup] Starting OCR garbage cleanup (${isDryRun ? "DRY RUN" : "APPLYING CHANGES"})...`
  );

  // Fetch all completed auctions with catalog data
  const PAGE_SIZE = 100;
  let offset = 0;
  let totalRecords = 0;
  let totalFixed = 0;
  let totalDescriptionsFixed = 0;

  while (true) {
    const { data: records, error } = await supabase
      .from("mstc_auctions")
      .select("id, mstc_auction_number, raw_materials_text")
      .eq("asset_status", "completed")
      .not("raw_materials_text", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[Cleanup] Database query error:", error.message);
      break;
    }

    if (!records || records.length === 0) break;

    for (const record of records) {
      totalRecords++;
      let summaryObj: any;

      try {
        summaryObj = JSON.parse(record.raw_materials_text);
      } catch {
        // Not valid JSON — skip (likely legacy format)
        continue;
      }

      if (!summaryObj?.items || !Array.isArray(summaryObj.items)) continue;

      let recordChanged = false;
      let descriptionsFixed = 0;

      for (const item of summaryObj.items) {
        if (item.description && typeof item.description === "string") {
          const original = item.description;
          const cleaned = cleanMaterialDescription(original);

          if (cleaned !== original) {
            descriptionsFixed++;
            const preview =
              original.length > 80
                ? original.substring(0, 80) + "..."
                : original;
            const cleanedPreview =
              cleaned.length > 80
                ? cleaned.substring(0, 80) + "..."
                : cleaned;
            console.log(
              `  [Lot ${item.sr}] ${record.mstc_auction_number}`
            );
            console.log(`    BEFORE: ${preview}`);
            console.log(`    AFTER:  ${cleanedPreview}`);
            item.description = cleaned;
            recordChanged = true;
          }
        }

        if (item.subItems && Array.isArray(item.subItems)) {
          for (const sub of item.subItems) {
            if (sub.description && typeof sub.description === "string") {
              const original = sub.description;
              const cleaned = cleanMaterialDescription(original);

              if (cleaned !== original) {
                descriptionsFixed++;
                const preview =
                  original.length > 80
                    ? original.substring(0, 80) + "..."
                    : original;
                const cleanedPreview =
                  cleaned.length > 80
                    ? cleaned.substring(0, 80) + "..."
                    : cleaned;
                console.log(
                  `  [Lot ${item.sr} Sub] ${record.mstc_auction_number}`
                );
                console.log(`    BEFORE: ${preview}`);
                console.log(`    AFTER:  ${cleanedPreview}`);
                sub.description = cleaned;
                recordChanged = true;
              }
            }
          }
        }
      }

      if (recordChanged) {
        totalFixed++;
        totalDescriptionsFixed += descriptionsFixed;

        if (!isDryRun) {
          const { error: updateError } = await supabase
            .from("mstc_auctions")
            .update({
              raw_materials_text: JSON.stringify(summaryObj),
              updated_at: new Date().toISOString(),
            })
            .eq("id", record.id);

          if (updateError) {
            console.error(
              `  [ERROR] Failed to update ${record.mstc_auction_number}:`,
              updateError.message
            );
          } else {
            console.log(
              `  [UPDATED] ${record.mstc_auction_number} (${descriptionsFixed} descriptions cleaned)`
            );
          }
        }
      }
    }

    offset += PAGE_SIZE;
    if (records.length < PAGE_SIZE) break;
  }

  console.log("\n[Cleanup] Summary:");
  console.log(`  Records scanned:       ${totalRecords}`);
  console.log(`  Records with garbage:  ${totalFixed}`);
  console.log(`  Descriptions cleaned:  ${totalDescriptionsFixed}`);

  if (isDryRun && totalFixed > 0) {
    console.log(
      "\n  This was a DRY RUN. To apply changes, run with --apply flag:"
    );
    console.log(
      "  npx tsx scraper/cleanupGarbageDescriptions.ts --apply"
    );
  }
}

main().catch((err) => {
  console.error("[Cleanup] Fatal error:", err);
  process.exit(1);
});
