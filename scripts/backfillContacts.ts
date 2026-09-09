/**
 * Backfill script to re-extract keyContacts (with phone numbers and real emails)
 * for MSTC auctions from their stored catalog PDFs.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import pdf from "pdf-parse";
import { extractKeyContacts } from "../scraper/parsers/mstc/contactExtractor.js";
import { extractInspectionDetails } from "../scraper/parsers/mstc/inspectionExtractor.js";

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillSingleAuction(record: any): Promise<boolean> {
  try {
    if (!record.sanitized_document_path) {
      return false;
    }

    const res = await fetch(record.sanitized_document_path);
    if (!res.ok) {
      console.warn(`[SKIP] Could not fetch PDF for ${record.mstc_auction_number}: HTTP ${res.status}`);
      return false;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const parsedPdf = await pdf(buf);
    const cleanText = parsedPdf.text;
    if (!cleanText || cleanText.trim().length === 0) {
      return false;
    }

    let parsedSummary: any = {};
    try {
      parsedSummary = JSON.parse(record.raw_materials_text || "{}");
    } catch {
      parsedSummary = {};
    }

    const keyContacts = extractKeyContacts(cleanText);
    const inspectionDetails = extractInspectionDetails(cleanText, keyContacts);

    parsedSummary.keyContacts = keyContacts;
    parsedSummary.inspectionDetails = inspectionDetails;

    const { error: updateError } = await supabase
      .from("mstc_auctions")
      .update({
        raw_materials_text: JSON.stringify(parsedSummary),
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (updateError) {
      console.error(`[ERROR] DB update failed for ${record.mstc_auction_number}:`, updateError.message);
      return false;
    }

    console.log(`[SUCCESS] Updated contacts for ${record.mstc_auction_number}:`, keyContacts.map(c => `${c.name} (${c.phone || "No phone"})`));
    return true;
  } catch (err: any) {
    console.error(`[ERROR] Failed ${record.mstc_auction_number}:`, err.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const activeOnly = args.includes("--active");
  const limitArg = args.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
  const targeted = args.filter(a => !a.startsWith("--"));

  let query = supabase
    .from("mstc_auctions")
    .select("id, mstc_auction_number, sanitized_document_path, raw_materials_text")
    .not("sanitized_document_path", "is", null);

  if (targeted.length > 0) {
    const filters = targeted.map(a => `mstc_auction_number.ilike.%${a}%`).join(",");
    query = query.or(filters);
  } else if (activeOnly) {
    query = query.gte("closing_date", new Date().toISOString());
  }

  query = query.order("closing_date", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from("mstc_auctions")
      .select("id, mstc_auction_number, sanitized_document_path, raw_materials_text")
      .not("sanitized_document_path", "is", null);

    if (targeted.length > 0) {
      const filters = targeted.map(a => `mstc_auction_number.ilike.%${a}%`).join(",");
      q = q.or(filters);
    } else if (activeOnly) {
      q = q.gte("closing_date", new Date().toISOString());
    }

    q = q.order("closing_date", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);

    if (limit && allData.length + pageSize > limit) {
      q = q.limit(limit - allData.length);
    }

    const { data, error } = await q;
    if (error) {
      console.error("Query error:", error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < pageSize || (limit && allData.length >= limit)) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  console.log(`Found ${allData.length} total auctions to process...`);

  const CONCURRENCY = 15;
  let successCount = 0;
  for (let i = 0; i < allData.length; i += CONCURRENCY) {
    const chunk = allData.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(record => backfillSingleAuction(record)));
    successCount += results.filter(Boolean).length;
    console.log(`Progress: ${Math.min(i + CONCURRENCY, allData.length)} / ${allData.length} processed (${successCount} updated)`);
  }

  console.log(`\nDone! Successfully updated ${successCount} / ${allData.length} auctions.`);
}

main().catch(console.error);
