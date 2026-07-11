import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { parseMstcCatalogText } from "../scraper/parsers/mstcParser.js";
import { renderAndExtractPdfPages } from "../scraper/utils/pdfUtils.js";

dotenv.config({ path: path.resolve(".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parsePdfDateTimeToISO(dateTimeStr: string | undefined): string | null {
  if (!dateTimeStr) return null;
  const match = dateTimeStr.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += 2000;
    }
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
  }
  return null;
}

async function processBatch(records: any[]): Promise<number> {
  let updatedCount = 0;
  const concurrencyLimit = 10;
  
  for (let i = 0; i < records.length; i += concurrencyLimit) {
    const chunk = records.slice(i, i + concurrencyLimit);
    console.log(`  Processing sub-batch of records ${i} to ${Math.min(i + concurrencyLimit, records.length)}...`);
    
    const promises = chunk.map(async (record) => {
      try {
        if (!record.sanitized_document_path) {
          return false;
        }

        // Check if raw_materials_text is JSON
        let parsedSummary: any = {};
        try {
          parsedSummary = JSON.parse(record.raw_materials_text);
        } catch (e) {
          // Not JSON, or empty/malformed
        }

        // Download PDF from Supabase Storage using client
        let fileData;
        try {
          const url = new URL(record.sanitized_document_path);
          const parts = url.pathname.split("/storage/v1/object/public/");
          if (parts.length <= 1) {
            console.warn(`Invalid storage path format for ${record.mstc_auction_number}: ${record.sanitized_document_path}`);
            return false;
          }
          const bucketAndPath = parts[1];
          const firstSlash = bucketAndPath.indexOf("/");
          const bucket = bucketAndPath.substring(0, firstSlash);
          const filePath = bucketAndPath.substring(firstSlash + 1);

          const { data, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(filePath);

          if (downloadError) {
            console.warn(`Failed to download PDF for ${record.mstc_auction_number}: ${downloadError.message}`);
            return false;
          }
          fileData = data;
        } catch (e: any) {
          console.error(`Error initiating download for ${record.mstc_auction_number}:`, e.message);
          return false;
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        
        // Extract page text (falls back automatically to Tesseract OCR if text is empty/scanned)
        const pages = await renderAndExtractPdfPages(buffer, 10);
        const cleanText = pages.map(p => p.text).join("\n");

        if (!cleanText || cleanText.trim().length === 0) {
          console.warn(`No text content extracted for ${record.mstc_auction_number}`);
          return false;
        }

        // Parse with the new parser logic
        const newSummary = parseMstcCatalogText(
          cleanText,
          record.category_name,
          record.seller_name,
          record.location || ""
        );

        const updatePayload: any = {
          raw_materials_text: JSON.stringify(newSummary),
          updated_at: new Date().toISOString(),
        };

        if (newSummary.auctionStartTime) {
          const isoStart = parsePdfDateTimeToISO(newSummary.auctionStartTime);
          if (isoStart) {
            updatePayload.opening_date = isoStart;
          }
        }

        if (newSummary.auctionCloseTime) {
          const isoClose = parsePdfDateTimeToISO(newSummary.auctionCloseTime);
          if (isoClose) {
            updatePayload.closing_date = isoClose;
          }
        }

        const { error: updateError } = await supabase
          .from("mstc_auctions")
          .update(updatePayload)
          .eq("id", record.id);

        if (updateError) {
          console.error(`Failed to update DB for ${record.mstc_auction_number}:`, updateError.message);
          return false;
        } else {
          console.log(`[UPDATED] ${record.mstc_auction_number} -> Start: ${newSummary.auctionStartTime || "N/A"}, Close: ${newSummary.auctionCloseTime || "N/A"}`);
          return true;
        }
      } catch (err: any) {
        console.error(`Error processing record ${record.mstc_auction_number}:`, err.message);
        return false;
      }
    });

    const results = await Promise.all(promises);
    updatedCount += results.filter(Boolean).length;
  }
  
  return updatedCount;
}

async function run() {
  console.log("Starting parsing of existing catalogues (with Puppeteer OCR)...");

  let totalProcessed = 0;
  let totalUpdated = 0;
  let hasMore = true;
  let page = 0;
  const pageSize = 10;
  const maxRecords = 10; // Process 10 records for safety and speed

  while (hasMore && totalProcessed < maxRecords) {
    console.log(`Fetching batch ${page} (offset: ${page * pageSize})...`);
    
    // Fetch completed records
    const { data: records, error } = await supabase
      .from("mstc_auctions")
      .select("id, mstc_auction_number, sanitized_document_path, raw_materials_text, category_name, seller_name, location")
      .eq("asset_status", "completed")
      .order("scraped_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching records:", error);
      break;
    }

    if (!records || records.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${records.length} records...`);
    const updatedInBatch = await processBatch(records);
    totalProcessed += records.length;
    totalUpdated += updatedInBatch;

    console.log(`Batch processed. Updated: ${updatedInBatch}. Total processed: ${totalProcessed}. Total updated: ${totalUpdated}`);

    if (records.length < pageSize || totalProcessed >= maxRecords) {
      hasMore = false;
    } else {
      page++;
    }

    // Add a small delay between pages to prevent rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`Completed parsing. Processed: ${totalProcessed}, Updated: ${totalUpdated}`);
  
  // Explicitly close browser singleton
  try {
    const { closeBrowser } = await import("../scraper/utils/pdfUtils.js");
    await closeBrowser();
  } catch (err) {}
}

run();
