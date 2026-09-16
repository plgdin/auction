/**
 * GeM Dedicated Asset Worker
 * 
 * Scans public.gem_auctions for records that need official document generation
 * and Supabase Storage upload (analogous to MSTC assetWorker.ts and baanknetAssetWorker.ts).
 * 
 * Usage:
 *   npx tsx scraper/gemAssetWorker.ts [--batch-size=20] [--force] [--headful]
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";
import { supabase, assertSupabaseCredentials } from "./utils/common/storage.js";
import { logger } from "./utils/common/logger.js";
import { sendPipelineFailureAlert } from "./utils/common/alertingService.js";
import {
  generateAndUploadGemNoticePdf,
  downloadAndUploadGemAttachment,
} from "./utils/gem/gemDocumentService.js";
import { parseGemNoticeHtml } from "./parsers/gem/gemParser.js";
import { parseGemNoticeText } from "./parsers/gem/gemNoticeTextParser.js";
import { POLL_INTERVAL_MS } from "./config.js";

puppeteer.use(StealthPlugin());

const log = logger.child({ service: "gem-asset-worker" });

interface WorkerOptions {
  batchSize: number;
  force: boolean;
  headful: boolean;
  daemon: boolean;
}

function parseCliArgs(): WorkerOptions {
  const args = process.argv.slice(2);
  let batchSize = 20;
  let force = false;
  let headful = false;
  let daemon = false;

  for (const arg of args) {
    if (arg.startsWith("--batch-size=")) {
      batchSize = parseInt(arg.replace("--batch-size=", ""), 10) || 20;
    }
    if (arg === "--force") {
      force = true;
    }
    if (arg === "--headful") {
      headful = true;
    }
    if (arg === "--daemon") {
      daemon = true;
    }
  }

  return { batchSize, force, headful, daemon };
}

async function runGemAssetWorker(): Promise<void> {
  assertSupabaseCredentials();
  const options = parseCliArgs();

  log.info(
    { batchSize: options.batchSize, force: options.force },
    "Starting GeM Asset Worker..."
  );

  // 1. Query records needing document ingestion
  let query = supabase
    .from("gem_auctions")
    .select("id, gem_auction_id, title, source_url, document_url, document_urls, corrigendum_urls")
    .order("created_at", { ascending: false })
    .limit(options.batchSize);

  if (!options.force) {
    // Only process auctions whose document_url does not yet point to Supabase Storage
    query = query.or("document_url.is.null,document_url.not.ilike.%supabase.co%");
  }

  const { data: records, error } = await query;

  if (error) {
    log.error({ error: error.message }, "Failed to fetch GeM auctions for asset processing");
    process.exit(1);
  }

  if (!records || records.length === 0) {
    log.info("No GeM auctions pending document download and storage upload. Exiting.");
    process.exit(0);
  }

  log.info({ pendingCount: records.length }, "Found GeM auctions to process documents for");

  // 2. Launch headless browser
  const browser = (await puppeteer.launch({
    headless: !options.headful,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1280,800",
    ],
  })) as unknown as Browser;

  let successCount = 0;
  let failureCount = 0;
  const failures: Array<{ auctionId: string; error: string }> = [];

  try {
    // Warm up home session for any required cookies
    const page = await browser.newPage();
    await page.goto("https://forwardauction.gem.gov.in/eprocure/home", {
      waitUntil: "networkidle2",
      timeout: 30000,
    }).catch(() => {});

    for (const record of records) {
      const auctionId = record.gem_auction_id;
      const sourceUrl = record.source_url || `https://forwardauction.gem.gov.in/eprocure/view-auction-notice/${auctionId}`;

      log.info({ auctionId, title: record.title }, "Processing documents for GeM auction...");

      try {
        // Fetch notice HTML in-session
        const noticeHtml = await page.evaluate(async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) return "";
          return await res.text();
        }, sourceUrl);

        if (!noticeHtml) {
          log.warn({ auctionId, sourceUrl }, "Could not fetch notice HTML for auction");
          failureCount++;
          continue;
        }

        // 3. Render and upload official notice PDF to Supabase Storage
        const docResult = await generateAndUploadGemNoticePdf(
          browser,
          auctionId,
          noticeHtml,
          record.title,
          options.force
        );

        // 4. Extract any attachment or corrigendum links from the notice
        const parsedNotice = parseGemNoticeHtml(noticeHtml);
        const uploadedDocUrls: string[] = [docResult.publicUrl];
        const uploadedCorrigendumUrls: string[] = [];

        if (parsedNotice.corrigendum_urls && parsedNotice.corrigendum_urls.length > 0) {
          for (let i = 0; i < parsedNotice.corrigendum_urls.length; i++) {
            const corrUrl = parsedNotice.corrigendum_urls[i];
            const uploadedUrl = await downloadAndUploadGemAttachment(browser, auctionId, corrUrl, i + 1);
            if (uploadedUrl) {
              uploadedCorrigendumUrls.push(uploadedUrl);
            }
          }
        }

        // 5. Extract deep intelligence from the PDF text
        let boqItems: any[] = [];
        let inspectionDate: string | null = null;
        let inspectionLocation: string | null = null;

        if (docResult.extractedText && docResult.extractedText.length > 50) {
          try {
            const textIntel = parseGemNoticeText(docResult.extractedText);
            boqItems = textIntel.boqItems;
            inspectionDate = textIntel.inspectionDate;
            inspectionLocation = textIntel.inspectionLocation;

            if (boqItems.length > 0) {
              log.info(
                { auctionId, boqItemCount: boqItems.length },
                "Extracted BOQ items from notice PDF text"
              );
            }
          } catch (parseErr: any) {
            log.warn({ auctionId, error: parseErr.message }, "Non-critical: notice text parsing failed");
          }
        }

        // 6. Update database record with permanent Supabase Storage public URLs and intelligence
        const updatePayload: Record<string, any> = {
          document_url: docResult.publicUrl,
          document_urls: uploadedDocUrls,
          documents_archived: true,
          documents_archived_at: new Date().toISOString(),
        };

        if (docResult.extractedText) {
          updatePayload.extracted_pdf_text = docResult.extractedText.substring(0, 100000);
        }
        if (docResult.previewUrl) {
          updatePayload.preview_url = docResult.previewUrl;
        }
        if (boqItems.length > 0) {
          updatePayload.boq_items = boqItems;
        }
        if (inspectionDate) {
          updatePayload.inspection_date = inspectionDate;
        }
        if (inspectionLocation) {
          updatePayload.inspection_location = inspectionLocation;
        }
        if (uploadedCorrigendumUrls.length > 0) {
          updatePayload.corrigendum_urls = uploadedCorrigendumUrls;
        }

        const { error: updateErr } = await supabase
          .from("gem_auctions")
          .update(updatePayload)
          .eq("id", record.id);

        if (updateErr) {
          log.warn({ auctionId, error: updateErr.message }, "Failed to update auction record in db");
          failureCount++;
          failures.push({ auctionId, error: updateErr.message });
        } else {
          try {
            await supabase.from("audit_logs").insert({
              action: "gem_auction_document_downloaded",
              entity_type: "gem_auction",
              entity_id: record.id,
              details: {
                gem_auction_id: auctionId,
                document_url: docResult.publicUrl,
                corrigendum_count: uploadedCorrigendumUrls.length,
              },
            });
          } catch {}

          log.info(
            { auctionId, document_url: docResult.publicUrl },
            "Successfully processed and stored GeM auction document"
          );
          successCount++;
        }
      } catch (err: any) {
        log.error({ auctionId, error: err.message }, "Error processing GeM auction documents");
        failureCount++;
        failures.push({ auctionId, error: err.message });
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  log.info(
    { total: records.length, successCount, failureCount },
    "GeM Asset Worker run finished."
  );

  if (failures.length > 0) {
    await sendPipelineFailureAlert({
      serviceName: "GeM Asset Worker",
      totalInspected: records.length,
      totalFailed: failures.length,
      failures,
    });
  }
}

runGemAssetWorker().then(async () => {
  const options = parseCliArgs();
  if (options.daemon) {
    log.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Entering daemon mode...");
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        await runGemAssetWorker();
      } catch (err: any) {
        log.error({ error: err.message }, "Daemon iteration failed");
      }
    }
  }
}).catch((err) => {
  log.error({ error: err.message }, "Fatal error in GeM Asset Worker");
  process.exit(1);
});
