/**
 * BaankNet Database & Document Coverage Audit Script
 *
 * Audits total auctions, categorized counts, documents coverage,
 * and intelligence fields captured vs missing in Supabase.
 *
 * Usage:
 *   npx tsx scraper/auditBaanknetCoverage.ts
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

async function runAudit() {
  console.log("\n=======================================================");
  console.log("   📊 BAANKNET AUCTION & DOCUMENT COVERAGE AUDIT");
  console.log("=======================================================\n");

  const { data: records, error } = await supabase
    .from("baanknet_auctions")
    .select(`
      id, baanknet_auction_id, title, property_type, category_name,
      reserve_price_value, reserve_price_text, emd_amount_value, emd_amount_text,
      bid_increment_amount, bid_increment_text, emd_account_number, emd_account_ifsc,
      bank_name, branch_name, state, city, location, full_address,
      cersai_id, title_type, encumbrances_text,
      corporate_debtor_name, nclt_bench, nclt_case_no, process_memo_url,
      document_url, document_urls, stored_document_urls, documents_archived,
      thumbnail_url, auction_start_date, auction_end_date, auction_status
    `);

  if (error) {
    console.error("Database query failed:", error.message);
    return;
  }

  if (!records || records.length === 0) {
    console.log("No BaankNet auctions found in database.");
    return;
  }

  const total = records.length;
  console.log(`Total BaankNet Auctions in Database: ${total}\n`);

  // 1. Module & Category Breakdown
  const categories: Record<string, number> = {};
  const propertyTypes: Record<string, number> = {};
  const banks: Record<string, number> = {};

  let withPrice = 0;
  let withEmd = 0;
  let withBidIncrement = 0;
  let withBankRemittance = 0;
  let withCersai = 0;
  let withAddress = 0;
  let withIBC = 0;
  let withPhotos = 0;
  let withDocUrls = 0;
  let withStoredDocs = 0;
  let fullyArchivedDocs = 0;

  for (const r of records) {
    const cat = r.category_name || "Uncategorized";
    categories[cat] = (categories[cat] || 0) + 1;

    const pType = r.property_type || "Unknown Type";
    propertyTypes[pType] = (propertyTypes[pType] || 0) + 1;

    const bank = r.bank_name || "Unknown Bank";
    banks[bank] = (banks[bank] || 0) + 1;

    if (r.reserve_price_value || r.reserve_price_text) withPrice++;
    if (r.emd_amount_value || r.emd_amount_text) withEmd++;
    if (r.bid_increment_amount || r.bid_increment_text) withBidIncrement++;
    if (r.emd_account_number || r.emd_account_ifsc) withBankRemittance++;
    if (r.cersai_id) withCersai++;
    if (r.full_address && r.full_address.length > 5 && !r.full_address.includes("not provided")) withAddress++;
    if (r.corporate_debtor_name || r.nclt_bench || r.process_memo_url) withIBC++;
    
    if (r.thumbnail_url && r.thumbnail_url.length > 5) withPhotos++;

    const docCount = (r.document_urls?.length || 0) + (r.document_url ? 1 : 0);
    if (docCount > 0) withDocUrls++;

    const storedDocCount = r.stored_document_urls?.length || 0;
    if (storedDocCount > 0) withStoredDocs++;
    if (r.documents_archived) fullyArchivedDocs++;
  }

  console.log("--- 📂 ASSET CATEGORIES ---");
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  • ${cat.padEnd(25)}: ${count} (${((count / total) * 100).toFixed(1)}%)`);
  }

  console.log("\n--- 🏷️ PROPERTY / VEHICLE TYPES ---");
  for (const [pt, count] of Object.entries(propertyTypes).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  • ${pt.padEnd(30)}: ${count} (${((count / total) * 100).toFixed(1)}%)`);
  }

  console.log("\n--- 🏦 TOP LENDING INSTITUTIONS ---");
  for (const [b, count] of Object.entries(banks).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  • ${b.padEnd(30)}: ${count} (${((count / total) * 100).toFixed(1)}%)`);
  }

  console.log("\n--- 📄 DOCUMENT & PHOTO COVERAGE ---");
  console.log(`  • Auctions with Photo Galleries     : ${withPhotos} / ${total} (${((withPhotos / total) * 100).toFixed(1)}%)`);
  console.log(`  • Auctions with Notice PDF URLs     : ${withDocUrls} / ${total} (${((withDocUrls / total) * 100).toFixed(1)}%)`);
  console.log(`  • Auctions with Mirrored Storage PDF: ${withStoredDocs} / ${total} (${((withStoredDocs / total) * 100).toFixed(1)}%)`);
  console.log(`  • Auctions with Full Document Archive: ${fullyArchivedDocs} / ${total} (${((fullyArchivedDocs / total) * 100).toFixed(1)}%)`);

  console.log("\n--- 🧠 BID INTELLIGENCE & DUE DILIGENCE COVERAGE ---");
  console.log(`  • Reserve Price Captured            : ${withPrice} / ${total} (${((withPrice / total) * 100).toFixed(1)}%)`);
  console.log(`  • EMD Deposit Captured              : ${withEmd} / ${total} (${((withEmd / total) * 100).toFixed(1)}%)`);
  console.log(`  • Bid Increment Step Captured       : ${withBidIncrement} / ${total} (${((withBidIncrement / total) * 100).toFixed(1)}%)`);
  console.log(`  • EMD Bank Account / IFSC Remittance: ${withBankRemittance} / ${total} (${((withBankRemittance / total) * 100).toFixed(1)}%)`);
  console.log(`  • CERSAI Security ID Captured       : ${withCersai} / ${total} (${((withCersai / total) * 100).toFixed(1)}%)`);
  console.log(`  • Full Street Address Captured      : ${withAddress} / ${total} (${((withAddress / total) * 100).toFixed(1)}%)`);
  console.log(`  • IBC Insolvency / NCLT Cases       : ${withIBC} / ${total} (${((withIBC / total) * 100).toFixed(1)}%)`);

  console.log("\n=======================================================\n");
}

runAudit();
