/**
 * Backfill script to update all completed auctions with clean quantity/unit data.
 *
 * Usage: npx tsx scratch/backfill_clean_qtys.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fetch from "node-fetch";
import { createRequire } from "module";
import { parseMstcCatalogText } from "../scraper/parsers/mstcParser.js";
import { calculateTotalMarketValue } from "../src/utils/valuationUtils.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Querying completed mstc_auctions records...");
  const { data: records, error } = await supabase
    .from("mstc_auctions")
    .select(
      "id, mstc_auction_number, sanitized_document_path, category_name, seller_name, location, raw_materials_text",
    )
    .eq("asset_status", "completed")
    .not("sanitized_document_path", "is", null);

  if (error || !records) {
    console.error("Failed to fetch records:", error?.message);
    return;
  }

  console.log(`Found ${records.length} completed records to re-parse.\n`);

  let successCount = 0;
  let failCount = 0;

  for (const record of records) {
    console.log(`Processing: ${record.mstc_auction_number}`);

    try {
      const res = await fetch(record.sanitized_document_path);
      if (!res.ok) {
        console.log(`  ❌ [SKIP] Download failed with status ${res.status}`);
        failCount++;
        continue;
      }

      const buffer = await res.buffer();
      if (buffer.toString("utf-8", 0, 4) !== "%PDF") {
        console.log("  ❌ [SKIP] Downloaded file is not a valid PDF");
        failCount++;
        continue;
      }

      const parsedPdf = await pdf(buffer);
      const text: string = parsedPdf.text || "";

      const result = parseMstcCatalogText(
        text,
        record.category_name || "",
        record.seller_name || "",
        record.location || "",
      );

      // Preserve existing images, attachment mappings, and eligibility notes from the database if they exist
      try {
        const oldParsed = JSON.parse(record.raw_materials_text);
        if (oldParsed.preview_image_url) {
          result.preview_image_url = oldParsed.preview_image_url;
        }
        if (oldParsed.extracted_images) {
          result.extracted_images = oldParsed.extracted_images;
        }
        if (oldParsed.attachmentMap) {
          (result as any).attachmentMap = oldParsed.attachmentMap;
        }
        if (oldParsed.eligibility) {
          result.eligibility = oldParsed.eligibility;
        }

        // Map and preserve lot specific images
        if (
          oldParsed.items &&
          Array.isArray(oldParsed.items) &&
          result.items &&
          Array.isArray(result.items)
        ) {
          for (let i = 0; i < result.items.length; i++) {
            const oldItem = oldParsed.items.find(
              (oi: any) => String(oi.sr) === String(result.items[i].sr),
            );
            if (oldItem) {
              if (oldItem.images) {
                result.items[i].images = oldItem.images;
              }
              // Preserve other parameters like manual override price or custom name
              if (oldItem.marketPrice) {
                result.items[i].marketPrice = oldItem.marketPrice;
              }
              // Preserve OCR-extracted quantities and units if they are more specific than generic "1 Lot"
              const oldQtyLower = (oldItem.qty || "").toString().toLowerCase().trim();
              const oldUnitLower = (oldItem.unit || "").toString().toLowerCase().trim();
              const isOldGeneric =
                oldQtyLower === "1" ||
                oldQtyLower === "1.0" ||
                oldUnitLower === "lot" ||
                oldUnitLower === "lots";

              if (!isOldGeneric && oldItem.qty) {
                result.items[i].qty = oldItem.qty;
                result.items[i].unit = oldItem.unit || result.items[i].unit;
              }
            }
          }
        }
      } catch (e) {
        // Ignore JSON parsing errors for old text
      }

      // Recalculate total market value with clean quantities
      try {
        const totalMarketValue = calculateTotalMarketValue(
          result.items || [],
          record.category_name || "",
        );
        result.totalMarketValue = totalMarketValue;
        console.log(`  Calculated Market Value: ₹${totalMarketValue.toLocaleString("en-IN")}`);
      } catch (valErr: any) {
        console.log(`  ⚠️ Failed to calculate market value: ${valErr.message}`);
      }

      const newJson = JSON.stringify(result);

      const { error: updateError } = await supabase
        .from("mstc_auctions")
        .update({ raw_materials_text: newJson })
        .eq("id", record.id);

      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
        failCount++;
      } else {
        console.log(`  ✅ Successfully updated — ${result.items.length} lots`);
        successCount++;
      }
    } catch (err: any) {
      console.log(`  ❌ Error processing record: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`BACKFILL COMPLETE: ${successCount} updated, ${failCount} failed`);
  console.log("=".repeat(60));
}

run().catch(console.error);
