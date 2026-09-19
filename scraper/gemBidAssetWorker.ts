/**
 * GeM Dedicated Authentic Bid Asset Worker
 *
 * Scans public.gem_bids for records needing authentic document ingestion:
 * 1. Resolves active GeM portal session on bidplus.gem.gov.in
 * 2. Downloads authentic government-uploaded PDF bid documents
 * 3. Verifies %PDF binary integrity and magic bytes
 * 4. Extracts selectable text, untruncated item names, department/ministry, buyer emails, quantities
 * 5. Uploads documents to Supabase Storage (gem-bids/{sanitized_bid_no}/...)
 * 6. Computes dynamic status (upcoming, live, closed) based on start and end dates
 * 7. Persists public CDN URLs and extracted intelligence back to public.gem_bids
 *
 * Usage:
 *   npx tsx scraper/gemBidAssetWorker.ts [--batch-size=20] [--force] [--headful] [--daemon]
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import { supabase, assertSupabaseCredentials } from "./utils/common/storage.js";
import { logger } from "./utils/common/logger.js";
import { processAndUploadGemBidDocument } from "./utils/gem/gemBidDocumentService.js";
import { POLL_INTERVAL_MS, DEFAULT_USER_AGENT } from "./config.js";

puppeteer.use(StealthPlugin());

const log = logger.child({ service: "gem-bid-asset-worker" });

interface WorkerOptions {
  batchSize: number;
  force: boolean;
  headful: boolean;
  daemon: boolean;
  [key: string]: unknown;
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
 * Computes the real status of a GeM bid based on its start and end dates.
 */
function computeBidStatus(startDateStr?: string | null, endDateStr?: string | null): string {
  const now = Date.now();
  if (endDateStr) {
    const endMs = new Date(endDateStr).getTime();
    if (!isNaN(endMs) && now > endMs) {
      return "closed";
    }
  }
  if (startDateStr) {
    const startMs = new Date(startDateStr).getTime();
    if (!isNaN(startMs) && now < startMs) {
      return "upcoming";
    }
  }
  return "live";
}

/**
 * Initializes Puppeteer browser and warms up a session on BidPlus.
 */
async function initSession(headful: boolean): Promise<{ browser: Browser; page: Page }> {
  log.info("Launching Puppeteer browser for GeM Bids Asset Worker...");
  const browser = await puppeteer.launch({
    headless: !headful,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1400,900",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(DEFAULT_USER_AGENT);

  log.info("Warming up GeM BidPlus session at https://bidplus.gem.gov.in/all-bids...");
  try {
    await page.goto("https://bidplus.gem.gov.in/all-bids", {
      waitUntil: "networkidle2",
      timeout: 45000,
    });
    log.info("Session warm-up successful. Ready to process bid documents.");
  } catch (err: any) {
    log.warn({ error: err.message }, "Session warm-up encountered warning; proceeding anyway.");
  }

  return { browser, page };
}

/**
 * Fetches the next batch of pending GeM Bids that require authentic document archiving.
 */
async function fetchPendingBids(batchSize: number, force: boolean): Promise<any[]> {
  let query = supabase
    .from("gem_bids")
    .select("id, bid_number, items, department_name, start_date, end_date, document_url, document_urls, processing_status")
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (!force) {
    // Only fetch bids where document has not been uploaded to Supabase Storage yet
    query = query.not("document_url", "ilike", "%supabase.co%");
  }

  const { data, error } = await query;
  if (error) {
    log.error({ error: error.message }, "Failed to fetch pending bids from database");
    return [];
  }

  return data || [];
}

/**
 * Main worker loop.
 */
export async function runWorker(): Promise<void> {
  assertSupabaseCredentials();
  const options = parseCliArgs();

  log.info({ ...options }, "Starting GeM Bid Asset Worker...");

  let browserContext: { browser: Browser; page: Page } | null = null;

  try {
    browserContext = await initSession(options.headful);
    let { browser, page } = browserContext;

    let consecutiveEmptyCycles = 0;

    do {
      const pendingBids = await fetchPendingBids(options.batchSize, options.force);

      if (pendingBids.length === 0) {
        log.info("No pending GeM bids found requiring document archiving.");
        consecutiveEmptyCycles++;

        if (!options.daemon || consecutiveEmptyCycles > 3) {
          log.info("Exiting worker process as all bids are archived.");
          break;
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      consecutiveEmptyCycles = 0;
      log.info({ count: pendingBids.length }, `Processing batch of ${pendingBids.length} GeM Bids...`);

      let processedCount = 0;
      let successCount = 0;
      let failCount = 0;

      for (const bid of pendingBids) {
        processedCount++;
        const bidNo = bid.bid_number;
        const rawDocUrl = bid.document_url || `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(bidNo)}`;

        log.info(
          { index: processedCount, total: pendingBids.length, bidNumber: bidNo },
          `[${processedCount}/${pendingBids.length}] Ingesting document for GeM Bid ${bidNo}...`
        );

        try {
          const result = await processAndUploadGemBidDocument(bidNo, rawDocUrl, page);

          if (!result || !result.publicUrl) {
            log.warn({ bidNumber: bidNo }, "Failed to process and upload authentic bid document");
            await supabase
              .from("gem_bids")
              .update({
                processing_status: "failed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", bid.id);
            failCount++;
            continue;
          }

          // Compute accurate dynamic status
          const effectiveEndDate = result.metadata.endDate || bid.end_date;
          const dynamicStatus = computeBidStatus(bid.start_date, effectiveEndDate);

          const updatePayload: Record<string, any> = {
            document_url: result.publicUrl,
            document_urls: [result.publicUrl],
            processing_status: "completed",
            status: dynamicStatus,
            updated_at: new Date().toISOString(),
          };

          // Enrich with un-truncated item category/name if available
          if (result.metadata.untruncatedItemName && result.metadata.untruncatedItemName.length > 2) {
            updatePayload.items = result.metadata.untruncatedItemName;
          }

          // Enrich department hierarchy if available
          const deptParts = [
            result.metadata.ministry,
            result.metadata.organisation,
            result.metadata.departmentName,
          ].filter(Boolean) as string[];

          if (deptParts.length > 0) {
            updatePayload.department_name = Array.from(new Set(deptParts)).join(" - ");
          } else if (result.metadata.departmentName) {
            updatePayload.department_name = result.metadata.departmentName;
          }

          if (result.metadata.quantity) {
            updatePayload.quantity = result.metadata.quantity;
          }
          if (result.metadata.endDate) {
            updatePayload.end_date = result.metadata.endDate;
          }

          const { error: updateErr } = await supabase
            .from("gem_bids")
            .update(updatePayload)
            .eq("id", bid.id);

          if (updateErr) {
            log.error({ bidNumber: bidNo, error: updateErr.message }, "Failed to update gem_bids database record");
            failCount++;
          } else {
            log.info(
              { bidNumber: bidNo, publicUrl: result.publicUrl, status: dynamicStatus },
              "Successfully archived GeM bid document and updated database record"
            );
            successCount++;
          }
        } catch (bidErr: any) {
          log.error({ bidNumber: bidNo, error: bidErr.message }, "Unexpected error processing bid");
          failCount++;
        }

        // Polite throttle between document downloads (1.5s - 2.5s)
        const throttleMs = 1500 + Math.floor(Math.random() * 1000);
        await new Promise((r) => setTimeout(r, throttleMs));
      }

      log.info(
        { batchSize: pendingBids.length, success: successCount, failed: failCount },
        "Batch processing complete."
      );

      if (options.daemon) {
        log.info({ pollIntervalMs: POLL_INTERVAL_MS }, "Sleeping before next polling cycle...");
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } while (options.daemon);
  } catch (criticalErr: any) {
    log.error({ error: criticalErr.message }, "Critical worker failure");
  } finally {
    if (browserContext?.browser) {
      await browserContext.browser.close().catch(() => {});
      log.info("Browser closed cleanly.");
    }
  }
}

// Execute CLI run if invoked directly
if (process.argv[1]?.includes("gemBidAssetWorker")) {
  runWorker()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
