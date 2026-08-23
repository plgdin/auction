/**
 * BaankNet Comprehensive Retroactive Backfill Script
 *
 * Retroactively re-parses and updates every existing record in `baanknet_auctions`
 * using the updated symmetric parsing and schema validation rules.
 * Cleans titles, addresses, categories, location fields, and dedup fingerprints.
 *
 * Usage:
 *   npx tsx scraper/backfillBaanknetListings.ts           # Dry run (preview only)
 *   npx tsx scraper/backfillBaanknetListings.ts --apply   # Apply changes to database
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { parseListings, type RawBaankNetItem } from "./parsers/baanknet/baanknetParser.js";
import { upsertListings } from "./baanknetScraper.js";

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

const isApply = process.argv.includes("--apply");
const BATCH_SIZE = 250;

async function runBackfill(): Promise<void> {
  console.log(`[BaankNet Backfill] Starting backfill process in ${isApply ? "LIVE APPLY" : "DRY RUN"} mode...`);

  // 1. Fetch count
  const { count, error: countError } = await supabase
    .from("baanknet_auctions")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Failed to query baanknet_auctions count:", countError.message);
    process.exit(1);
  }

  const totalRows = count || 0;
  console.log(`Found ${totalRows} total rows in baanknet_auctions.`);

  if (totalRows === 0) {
    console.log("No records to backfill.");
    return;
  }

  let totalInspected = 0;
  let totalFixed = 0;
  let totalErrors = 0;

  for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
    console.log(`Fetching batch ${Math.floor(offset / BATCH_SIZE) + 1} (offset: ${offset}, limit: ${BATCH_SIZE})...`);

    const { data: rows, error } = await supabase
      .from("baanknet_auctions")
      .select("*")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error.message);
      totalErrors++;
      continue;
    }

    if (!rows || rows.length === 0) break;

    const rawItems: RawBaankNetItem[] = [];
    const idsToDelete: string[] = [];

    for (const row of rows) {
      totalInspected++;

      const aid = (row.baanknet_auction_id || "").trim();
      const lowerAid = aid.toLowerCase();
      const isFakeNav =
        !aid ||
        aid.length <= 2 ||
        lowerAid === "guide" ||
        lowerAid === "user guide" ||
        lowerAid === "eauction" ||
        lowerAid === "home" ||
        lowerAid === "about" ||
        lowerAid === "contact" ||
        lowerAid === "date" ||
        lowerAid === "start" ||
        lowerAid === "end" ||
        lowerAid.startsWith("classification") ||
        lowerAid.startsWith("location") ||
        lowerAid.includes("search results") ||
        lowerAid.includes("properties found");

      if (isFakeNav) {
        idsToDelete.push(row.id);
        totalFixed++;
        console.log(`  [Purging Fake Navigation Row ID: "${aid}"]`);
        continue;
      }

      // Transform existing DB row back into RawBaankNetItem for complete deterministic re-parsing
      const rawItem: RawBaankNetItem = {
        auctionId: row.baanknet_auction_id,
        bankPropertyId: row.bank_property_id || row.baanknet_auction_id,
        title: row.title || row.raw_description || "",
        reservePrice: row.reserve_price_text || (row.reserve_price_value ? `₹ ${row.reserve_price_value}` : ""),
        bankName: row.bank_name || "Bank",
        location: row.location || `${row.city || ""}, ${row.state || ""}`,
        address: row.full_address || row.location || "",
        startDate: row.auction_start_date || "",
        endDate: row.auction_end_date || "",
        detailUrl: row.source_url || "",
        carpetArea: row.carpet_area || undefined,
        furnishing: row.furnishing || undefined,
        possessionStatus: row.possession_status || undefined,
        actionType: row.action_type || undefined,
        district: row.district || undefined,
        inspectionStartDate: row.inspection_start_date || undefined,
        inspectionEndDate: row.inspection_end_date || undefined,
        emdEndDate: row.emd_end_date || undefined,
        borrowerName: row.borrower_name || undefined,
        borrowerNames: row.borrower_names || undefined,
        description: row.property_description || row.raw_description || undefined,
        thumbnailUrl: row.thumbnail_url || undefined,
        documentUrl: row.document_url || undefined,
        documentUrls: row.document_urls || undefined,
        emdAmountText: row.emd_amount_text || (row.emd_amount_value ? `₹ ${row.emd_amount_value}` : undefined),
        emdAmountValue: row.emd_amount_value,
        bidIncrementText: row.bid_increment_text || (row.bid_increment_amount ? `₹ ${row.bid_increment_amount}` : undefined),
        bidIncrementAmount: row.bid_increment_amount,
        emdAccountNumber: row.emd_account_number || undefined,
        emdAccountIfsc: row.emd_account_ifsc || undefined,
        emdBankName: row.emd_bank_name || undefined,
        outstandingDuesText: row.outstanding_dues_text || (row.outstanding_dues_value ? `₹ ${row.outstanding_dues_value}` : undefined),
        outstandingDuesValue: row.outstanding_dues_value,
        tenderFeeText: row.tender_fee_text || (row.tender_fee_value ? `₹ ${row.tender_fee_value}` : undefined),
        tenderFeeValue: row.tender_fee_value,
        cersaiId: row.cersai_id || undefined,
        titleType: row.title_type || undefined,
        encumbrancesText: row.encumbrances_text || undefined,
        branchName: row.branch_name || undefined,
        officerDesignation: row.officer_designation || undefined,
        officerEmail: row.officer_email || undefined,
        contactPerson: row.contact_person || undefined,
        contactPhone: row.contact_phone || undefined,
        latitude: row.latitude,
        longitude: row.longitude,
        mapUrl: row.map_url || undefined,
        boundaries: row.boundaries || undefined,
        corporateDebtorName: row.corporate_debtor_name || undefined,
        corporateDebtorCin: row.corporate_debtor_cin || undefined,
        liquidatorRegNo: row.liquidator_reg_no || undefined,
        liquidatorEmail: row.liquidator_email || undefined,
        ncltBench: row.nclt_bench || undefined,
        ncltCaseNo: row.nclt_case_no || undefined,
        processMemoUrl: row.process_memo_url || undefined,
        extractedPdfText: row.extracted_pdf_text || undefined,
        auctionModule: row.auction_module || "eauction_psb",
      };

      rawItems.push(rawItem);
    }

    if (isApply && idsToDelete.length > 0) {
      await supabase.from("baanknet_auctions").delete().in("id", idsToDelete);
    }

    // Re-parse listings with current high-precision parsers
    const reParsed = parseListings(rawItems);

    for (let j = 0; j < reParsed.length; j++) {
      const parsedItem = reParsed[j];
      const originalRow = rows[j];

      const hasTitleDifference = parsedItem.title !== originalRow.title;
      const hasCategoryDifference = parsedItem.category_name !== originalRow.category_name;
      const hasCityDifference = parsedItem.city !== originalRow.city;

      if (hasTitleDifference || hasCategoryDifference || hasCityDifference) {
        totalFixed++;
        if (totalFixed <= 10 || !isApply) {
          console.log(`  [Cleaned ID: ${parsedItem.baanknet_auction_id}]`);
          if (hasTitleDifference) {
            console.log(`    Title: "${originalRow.title}" -> "${parsedItem.title}"`);
          }
          if (hasCategoryDifference) {
            console.log(`    Category: "${originalRow.category_name}" -> "${parsedItem.category_name}"`);
          }
        }
      }
    }

    if (isApply && reParsed.length > 0) {
      try {
        await upsertListings(reParsed);
      } catch (err: any) {
        console.error(`Failed to upsert batch at offset ${offset}:`, err.message);
        totalErrors++;
      }
    }
  }

  console.log("\n=======================================================");
  console.log(`BaankNet Backfill ${isApply ? "Completed" : "Dry Run Summary"}:`);
  console.log(`  Total Inspected : ${totalInspected}`);
  console.log(`  Total Fixed     : ${totalFixed}`);
  console.log(`  Total Errors    : ${totalErrors}`);
  console.log(`  Mode            : ${isApply ? "APPLIED TO DATABASE" : "DRY RUN (Use --apply to commit)"}`);
  console.log("=======================================================\n");
}

runBackfill().catch((err) => {
  console.error("Backfill failed with unhandled error:", err);
  process.exit(1);
});
