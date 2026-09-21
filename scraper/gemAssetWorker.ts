/**
 * GeM Dedicated Authentic Asset Worker
 *
 * Scans public.gem_auctions for records needing genuine document ingestion:
 * 1. Resolves active GeM portal session & download links
 * 2. Downloads authentic government-uploaded PDF notices & attachments
 * 3. Verifies %PDF binary integrity and magic bytes
 * 4. Extracts selectable text and OCR from scanned government notices
 * 5. Generates high-res page-1 preview thumbnails
 * 6. Extracts structured BOQ schedule items
 * 7. Uploads files to Supabase Storage and persists intelligence to the database
 *
 * Usage:
 *   npx tsx scraper/gemAssetWorker.ts [--batch-size=20] [--force] [--headful] [--daemon]
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import { supabase, assertSupabaseCredentials } from "./utils/common/storage.js";
import { logger } from "./utils/common/logger.js";
import { sendPipelineFailureAlert } from "./utils/common/alertingService.js";
import {
  downloadAndProcessGemDocuments,
  downloadAndUploadGemAttachment,
  archiveGemCorrigenda,
} from "./utils/gem/gemDocumentService.js";
import { parseGemNoticeHtml, detectGeMReAuction } from "./parsers/gem/gemParser.js";
import { parseGemNoticeText } from "./parsers/gem/gemNoticeTextParser.js";
import { parseGemBusinessRulesHtml } from "./parsers/gem/gemBusinessRulesParser.js";
import { POLL_INTERVAL_MS, DEFAULT_USER_AGENT } from "./config.js";

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
    if (arg === "--force") force = true;
    if (arg === "--headful") headful = true;
    if (arg === "--daemon") daemon = true;
  }

  return { batchSize, force, headful, daemon };
}

/**
 * Searches the GeM Forward Auction portal home for an auction ID to obtain fresh,
 * active in-session links for Business Rules, Download Document, and Notice.
 */
async function resolveFreshAuctionLinks(
  page: Page,
  auctionId: string
): Promise<{
  docPageUrl?: string;
  rulesUrl?: string;
  noticeUrl?: string;
}> {
  try {
    log.info({ auctionId }, "Resolving fresh session links via GeM Portal search...");
    await page.goto("https://forwardauction.gem.gov.in/eprocure/home", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector("#keywrdSearch, .x-keyword-search", { timeout: 15000 });

    await page.evaluate((id: string) => {
      const input = (document.getElementById("keywrdSearch") ||
        document.querySelector(".x-keyword-search")) as HTMLInputElement;
      if (input) input.value = id;

      const btn = (document.getElementById("searchAuc") ||
        document.querySelector(".searchAuc, .searchBtn")) as HTMLButtonElement;
      if (btn) btn.click();
    }, auctionId);

    await new Promise((r) => setTimeout(r, 4000));

    const links = await page.evaluate((id: string) => {
      const docLink = document.querySelector(
        `a[href*='eauction-download-document/${id}'], a[href*='eauction-download-document']`
      ) as HTMLAnchorElement;
      const rulesLink = document.querySelector(
        `a[href*='view-configure-rule/${id}'], a[href*='view-configure-rule']`
      ) as HTMLAnchorElement;
      const noticeLink = document.querySelector(
        `a[href*='view-auction-notice/${id}'], a[href*='view-auction-notice']`
      ) as HTMLAnchorElement;

      return {
        docPageUrl: docLink ? docLink.getAttribute("href") || undefined : undefined,
        rulesUrl: rulesLink ? rulesLink.getAttribute("href") || undefined : undefined,
        noticeUrl: noticeLink ? noticeLink.getAttribute("href") || undefined : undefined,
      };
    }, auctionId);

    return links;
  } catch (err: any) {
    log.warn({ auctionId, error: err.message }, "Could not resolve fresh links via search");
    return {};
  }
}

async function runGemAssetWorker(): Promise<void> {
  assertSupabaseCredentials();
  const options = parseCliArgs();

  log.info(
    { batchSize: options.batchSize, force: options.force },
    "Starting GeM Authentic Asset Worker..."
  );

  // 1. Query records needing genuine document download & storage upload
  let query = supabase
    .from("gem_auctions")
    .select(
      "id, gem_auction_id, title, source_url, rules_url, doc_page_url, document_url, document_urls, corrigendum_urls, documents_archived, preview_url, boq_items, bid_increment_amount, office_zone, reserve_price_value"
    )
    .order("created_at", { ascending: false })
    .limit(options.batchSize);

  if (!options.force) {
    // Process auctions where documents are not yet archived in Supabase Storage
    query = query.or("documents_archived.is.null,documents_archived.eq.false,document_url.not.ilike.%supabase.co%");
  }

  const { data: records, error } = await query;

  if (error) {
    log.error({ error: error.message }, "Failed to fetch GeM auctions for asset processing");
    process.exit(1);
  }

  if (!records || records.length === 0) {
    log.info("No GeM auctions pending document processing. Exiting.");
    return;
  }

  log.info({ pendingCount: records.length }, "Found GeM auctions to process genuine documents for");

  // 2. Launch headless browser with stealth
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
    const page = await browser.newPage();
    await page.setUserAgent(DEFAULT_USER_AGENT);

    // Warm up home session for session cookies and CSRF
    await page.goto("https://forwardauction.gem.gov.in/eprocure/home", {
      waitUntil: "domcontentloaded",
      timeout: 35000,
    }).catch(() => {});

    for (const record of records) {
      const auctionId = record.gem_auction_id;
      log.info({ auctionId, title: record.title }, "Processing genuine assets for GeM auction...");

      try {
        // Find or resolve the authentic download document URL
        let freshLinks: { docPageUrl?: string; rulesUrl?: string; noticeUrl?: string } = {};
        let docPageUrl = record.document_url;
        const isAlreadyStorage = Boolean(docPageUrl && docPageUrl.includes("supabase.co"));

        // If docPageUrl is missing or doesn't have the active token, resolve it via search
        if (!docPageUrl || !docPageUrl.includes("eauction-download-document") || isAlreadyStorage) {
          freshLinks = await resolveFreshAuctionLinks(page, auctionId);
          if (freshLinks.docPageUrl) {
            docPageUrl = freshLinks.docPageUrl;
          }
        }

        if (!docPageUrl) {
          docPageUrl = `/eprocure/eauction-download-document/${auctionId}`;
        }

        // 3. Download genuine official documents from portal and mirror to Supabase Storage
        const docResult = await downloadAndProcessGemDocuments(
          browser,
          page,
          auctionId,
          docPageUrl,
          options.force
        );

        if (docResult.documents.length === 0) {
          log.warn({ auctionId }, "No valid documents could be downloaded for auction");
          failureCount++;
          failures.push({ auctionId, error: "No valid documents extracted from download page" });
          continue;
        }

        const uploadedDocUrls = docResult.documents.map((d) => d.publicUrl);
        const primaryDocUrl = docResult.primaryDocUrl || uploadedDocUrls[0];
        const primaryPreviewUrl = docResult.primaryPreviewUrl || null;

        // 4. Update database record with permanent CDN URLs and extracted intelligence
        const updatePayload: Record<string, any> = {
          document_url: primaryDocUrl,
          document_urls: uploadedDocUrls,
          documents_archived: true,
          documents_archived_at: new Date().toISOString(),
        };

        if (primaryPreviewUrl) {
          updatePayload.preview_url = primaryPreviewUrl;
        }
        if (docResult.combinedText && docResult.combinedText.trim().length > 20) {
          updatePayload.extracted_pdf_text = docResult.combinedText.trim().substring(0, 100000);
        }
        if (docResult.combinedBoqItems && docResult.combinedBoqItems.length > 0) {
          updatePayload.boq_items = docResult.combinedBoqItems;
        }
        if (docResult.discoveredAttachments && docResult.discoveredAttachments.length > 0) {
          updatePayload.discovered_api_attachments = docResult.discoveredAttachments;
        }
        if (docResult.inspectionDate) {
          updatePayload.inspection_date = docResult.inspectionDate;
        }
        if (docResult.inspectionLocation) {
          updatePayload.inspection_location = docResult.inspectionLocation;
        }

        // Re-auction detection
        const reAuction = detectGeMReAuction(record.title, docResult.combinedText);
        if (reAuction.is_reauction) {
          updatePayload.is_reauction = true;
          if (reAuction.original_auction_id) {
            updatePayload.original_auction_id = reAuction.original_auction_id;
          }
        }

        // Archive corrigendum documents if available
        if (record.corrigendum_urls && record.corrigendum_urls.length > 0) {
          try {
            const archivedCorri = await archiveGemCorrigenda(page, auctionId, record.corrigendum_urls);
            if (archivedCorri.length > 0) {
              updatePayload.corrigendum_urls = archivedCorri;
            }
          } catch {}
        }

        // Backfill business rules if missing from initial scrape
        const targetRulesUrl = freshLinks.rulesUrl || record.rules_url;
        if (targetRulesUrl && (!record.bid_increment_amount || !record.office_zone)) {
          try {
            await page.goto(targetRulesUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
            const rulesHtml = await page.content();
            const parsedRules = parseGemBusinessRulesHtml(rulesHtml);
            if (parsedRules.bid_increment_amount != null) updatePayload.bid_increment_amount = parsedRules.bid_increment_amount;
            if (parsedRules.office_zone) updatePayload.office_zone = parsedRules.office_zone;
            if (parsedRules.opening_price_value != null && !record.reserve_price_value) updatePayload.reserve_price_value = parsedRules.opening_price_value;
            if (parsedRules.extend_time_last_bid_min != null) updatePayload.extend_time_last_bid_min = parsedRules.extend_time_last_bid_min;
            if (parsedRules.extend_time_by_min != null) updatePayload.extend_time_by_min = parsedRules.extend_time_by_min;
            if (parsedRules.auto_extension) updatePayload.auto_extension = parsedRules.auto_extension;
            if (parsedRules.auto_extension_mode) updatePayload.auto_extension_mode = parsedRules.auto_extension_mode;
          } catch (rulesErr: any) {
            log.warn({ auctionId, error: rulesErr.message }, "Business rules backfill skipped on error");
          }
        }

        const { error: updateErr } = await supabase
          .from("gem_auctions")
          .update(updatePayload)
          .eq("id", record.id);

        if (updateErr) {
          log.error({ auctionId, error: updateErr.message }, "Failed to update auction record in db");
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
                document_url: primaryDocUrl,
                docs_count: uploadedDocUrls.length,
                boq_items_count: docResult.combinedBoqItems.length,
              },
            });
          } catch {}

          log.info(
            {
              auctionId,
              document_url: primaryDocUrl,
              docsCount: uploadedDocUrls.length,
              boqCount: docResult.combinedBoqItems.length,
            },
            "Successfully downloaded, verified, and archived genuine GeM document"
          );
          successCount++;
        }
      } catch (err: any) {
        log.error({ auctionId, error: err.message }, "Error processing GeM auction genuine assets");
        failureCount++;
        failures.push({ auctionId, error: err.message });
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  log.info(
    { total: records.length, successCount, failureCount },
    "GeM Authentic Asset Worker run finished."
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
