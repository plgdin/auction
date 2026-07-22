/**
 * BaankNet Multi-Module eAuction Scraper
 *
 * Scrapes bank-seized property auctions from baanknet.com across three modules:
 *
 *   1. eAuction PSB    — /eauction-psb/eproc-listing (SARFAESI bank auctions)
 *   2. Property Listing — /property-listing           (property marketplace with photos/area)
 *   3. IBC eAuction     — ibbi.baanknet.com           (IBC/NCLT insolvency auctions)
 *
 * Uses Puppeteer with stealth plugin. No CAPTCHA — fully headless.
 *
 * Usage:
 *   npx tsx scraper/baanknetScraper.ts
 *   npx tsx scraper/baanknetScraper.ts --module=eauction
 *   npx tsx scraper/baanknetScraper.ts --module=property
 *   npx tsx scraper/baanknetScraper.ts --module=ibc
 *   npx tsx scraper/baanknetScraper.ts --status=UPCOMING
 *   npx tsx scraper/baanknetScraper.ts --headful
 *   npx tsx scraper/baanknetScraper.ts --max-pages=10
 *   npx tsx scraper/baanknetScraper.ts --no-details    (skip detail page scraping)
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BAANKNET_BASE_URL,
  BAANKNET_EAUCTION_PATH,
  BAANKNET_PROPERTY_LISTING_PATH,
  BAANKNET_IBC_BASE_URL,
  BAANKNET_IBC_LISTING_PATH,
  BAANKNET_SCRAPE_DELAY_MS,
  BAANKNET_MAX_PAGES,
  BAANKNET_MAX_SCROLL_CYCLES,
  BAANKNET_STATUS_FILTERS,
  BAANKNET_SCRAPE_DETAILS,
  BAANKNET_DETAIL_CONCURRENCY,
  BAANKNET_MODULES,
  DEFAULT_USER_AGENT,
} from "./config.js";
import { logger } from "./utils/logger.js";
import {
  parseListings,
  computeDedupFingerprint,
  type RawBaankNetItem,
} from "./parsers/baanknetParser.js";
import {
  extractEAuctionDetail,
  extractPropertyListingCards,
  extractIBCListingCards,
  mergeDetailData,
  type DetailPageData,
} from "./parsers/baanknetDetailParser.js";
import { KNOWN_LENDERS } from "./data/knownLenders.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

puppeteer.use(StealthPlugin());

const log = logger.child({ module: "baanknetScraper" });

// ─── Supabase Client ─────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  log.error({}, "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

interface CliArgs {
  modules: string[];
  statusFilters: string[];
  headful: boolean;
  maxPages: number;
  startPage: number;
  scrapeDetails: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let headful = false;
  let statusFilters = [...BAANKNET_STATUS_FILTERS];
  let modules = [...BAANKNET_MODULES];
  let maxPages = BAANKNET_MAX_PAGES;
  let startPage = 1;
  let scrapeDetails = BAANKNET_SCRAPE_DETAILS;

  for (const arg of args) {
    if (arg === "--headful") headful = true;
    if (arg === "--no-details") scrapeDetails = false;
    if (arg.startsWith("--status=")) {
      statusFilters = arg.replace("--status=", "").split(",");
    }
    if (arg.startsWith("--module=")) {
      modules = arg.replace("--module=", "").split(",");
    }
    if (arg.startsWith("--max-pages=")) {
      maxPages = parseInt(arg.replace("--max-pages=", ""), 10);
    }
    if (arg.startsWith("--start-page=")) {
      startPage = parseInt(arg.replace("--start-page=", ""), 10);
    }
  }

  return { modules, statusFilters, headful, maxPages, startPage, scrapeDetails };
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function randomDelay(baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * baseMs * 0.5);
  const delay = baseMs + jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Process a batch of items concurrently for detail page scraping.
 * Opens multiple browser tabs in parallel up to BAANKNET_DETAIL_CONCURRENCY.
 */
async function scrapeDetailPages(
  browser: any,
  items: RawBaankNetItem[],
  baseUrl: string,
  concurrency: number,
): Promise<void> {
  // Filter to items that actually have detail URLs and haven't been enriched yet
  const toScrape = items.filter(
    (item) => item.detailUrl && !item.borrowerName && !item.description
  );

  if (toScrape.length === 0) {
    log.info("No detail pages to scrape (all items already enriched or no detail URLs).");
    return;
  }

  log.info({ count: toScrape.length, concurrency }, "Scraping detail pages...");

  // Process in batches of concurrency
  for (let i = 0; i < toScrape.length; i += concurrency) {
    const batch = toScrape.slice(i, i + concurrency);
    const promises = batch.map(async (item) => {
      let detailPage: any = null;
      try {
        const absoluteUrl = item.detailUrl!.startsWith("http")
          ? item.detailUrl!
          : `${baseUrl}${item.detailUrl}`;

        detailPage = await browser.newPage();
        await detailPage.setUserAgent(DEFAULT_USER_AGENT);
        await detailPage.evaluateOnNewDocument(() => {
          (window as any).__name = (window as any).__name || ((fn: any) => fn);
        });

        await detailPage.goto(absoluteUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await randomDelay(2000);

        const detail: DetailPageData = await detailPage.evaluate(extractEAuctionDetail, KNOWN_LENDERS);

        // Merge detail data into the item
        mergeDetailData(item, detail);

        log.info(
          {
            auctionId: item.auctionId,
            photos: detail.photoUrls.length,
            hasBorrower: !!detail.borrowerName,
          },
          "Detail page scraped"
        );
      } catch (err: any) {
        log.warn(
          { auctionId: item.auctionId, error: err.message },
          "Failed to scrape detail page"
        );
      } finally {
        if (detailPage) await detailPage.close().catch(() => {});
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (i + concurrency < toScrape.length) {
      await randomDelay(1000);
    }
  }

  log.info({ scraped: toScrape.length }, "Detail page scraping complete");
}

// ─── Expired Auction Cleanup ─────────────────────────────────────────────────

async function cleanupExpiredAuctions(): Promise<void> {
  log.info("Checking for expired BaankNet auctions...");

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: expired, error: fetchError } = await supabase
    .from("baanknet_auctions")
    .select("id, baanknet_auction_id, auction_end_date")
    .lt("auction_end_date", oneWeekAgo.toISOString());

  if (fetchError) {
    log.error({ error: fetchError.message }, "Failed to fetch expired BaankNet auctions");
    return;
  }

  if (!expired || expired.length === 0) {
    log.info("No expired BaankNet auctions to clean up.");
    return;
  }

  log.info({ count: expired.length }, "Found expired BaankNet auctions. Cleaning up...");

  // Audit log
  const logEntries = expired.map((auc) => ({
    action: "baanknet_auction_deleted",
    entity_type: "baanknet_auction",
    details: {
      baanknet_auction_id: auc.baanknet_auction_id as string,
      reason: "expired",
      auction_end_date: auc.auction_end_date as string,
    } as Record<string, string>,
  }));

  const { error: logError } = await supabase.from("audit_logs").insert(logEntries);
  if (logError) {
    log.error({ error: logError.message }, "Failed to write cleanup audit logs");
  }

  // Delete records (photos cascade via FK)
  const idsToDelete = expired.map((auc) => auc.id);
  const { error: deleteError } = await supabase
    .from("baanknet_auctions")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    log.error({ error: deleteError.message }, "Failed to delete expired BaankNet auctions");
  } else {
    log.info({ count: expired.length }, "Expired BaankNet auctions cleanup complete");
  }
}

// ─── DOM Extraction (eAuction PSB — runs inside Puppeteer page context) ──────

/**
 * Extracts all visible auction listing cards from the BaankNet eAuction page.
 * This function is serialized and run inside the browser.
 */
function extractEAuctionListingsFromDOM(knownLenders: string[] = []): RawBaankNetItem[] {
  if (typeof (window as any).__name === "undefined") {
    (window as any).__name = (target: any) => target;
  }
  const items: RawBaankNetItem[] = [];

  // Nested (not imported) — page.evaluate() serializes only this function's
  // body, so a top-level/imported helper would be undefined in the browser.
  // See the equivalent note in parsers/baanknetDetailParser.ts.
  function matchLenderInline(text: string, lenders: string[]): string {
    for (const lender of lenders) {
      const escaped = lender.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      if (re.test(text)) return lender;
    }
    return "";
  }

  // Each auction listing is a card/div with auction details
  const cards = document.querySelectorAll(
    ".card, .auction-card, .listing-card, [class*='auction'], [class*='listing']"
  );

  // Fallback: parse from the full page text structure
  const listingBlocks = document.querySelectorAll(
    ".mat-card, .mat-expansion-panel, .cdk-accordion-item, " +
    "[class*='result'], [class*='property'], [class*='item']"
  );

  const effectiveCards = cards.length > 0 && document.body?.innerText?.includes("Auction ID")
    ? cards
    : (listingBlocks.length > 0 ? listingBlocks : cards);

  effectiveCards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    if (!text.includes("Auction ID")) return;

    const auctionIdMatch = text.match(/Auction\s*ID\s*:\s*(\d+)/i);
    const bankPropIdMatch = text.match(/Bank\s*Property\s*ID\s*:\s*(\S+)/i);
    const reservePriceMatch = text.match(/Reserve\s*Price\s*:\s*([₹\s\d.,]+(?:Lakh|Crore|Lac)?)/i);

    // Curated list first — catches NBFCs/ARCs the old regex structurally
    // could not (it required the literal word "Bank" in the name).
    let bankName = matchLenderInline(text, knownLenders);
    if (!bankName) {
      const bankMatch = text.match(/(?:🏛|Bank\s*(?:Name)?)\s*:?\s*([A-Za-z\s]+(?:Bank|of\s+\w+)(?:\s+of\s+\w+)?)/i);
      bankName = bankMatch ? bankMatch[1].trim() : "";
    }

    // Title extraction
    const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    let title = "";
    for (const line of lines) {
      const titleMatch = line.match(/^\d+\)\s*(.+)/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        break;
      }
    }
    if (!title && lines.length > 0) title = lines[0];

    // Location
    let locationStr = "";
    for (const line of lines) {
      if (/^\w+,\s*\w+.*\d{6}/.test(line) || /^\w+,\s*\w+,\s*\w+/.test(line)) {
        locationStr = line;
        break;
      }
    }

    // Address
    let address = "";
    for (const line of lines) {
      if (line.includes("ROAD") || line.includes("STREET") || line.includes("NAGAR") ||
          line.includes("COLONY") || line.includes("SECTOR") || /^\d+/.test(line)) {
        if (!line.includes("Auction") && !line.includes("Date") && !line.includes("Price")) {
          address = line;
          break;
        }
      }
    }

    // Dates
    const startMatch = text.match(/Start\s*Date\s*:\s*([\d\-/]+\s+[\d:]+)/i);
    const endMatch = text.match(/End\s*Date\s*:\s*([\d\-/]+\s+[\d:]+)/i);

    // Detail and property links
    const auctionDetailLink = card.querySelector('a[href*="view-auction"]') as HTMLAnchorElement;
    const propertyDetailLink = card.querySelector('a[href*="view-property"], a[href*="property-detail"]') as HTMLAnchorElement;
    const detailUrl = auctionDetailLink?.getAttribute("href") || propertyDetailLink?.getAttribute("href") || "";

    if (auctionIdMatch) {
      items.push({
        auctionId: auctionIdMatch[1],
        bankPropertyId: bankPropIdMatch ? bankPropIdMatch[1] : "",
        title: title || "Bank Auction Property",
        reservePrice: reservePriceMatch ? reservePriceMatch[1].trim() : "",
        bankName: bankName || "Unknown Bank",
        location: locationStr,
        address: address,
        startDate: startMatch ? startMatch[1] : "",
        endDate: endMatch ? endMatch[1] : "",
        detailUrl: detailUrl,
        auctionModule: "eauction_psb",
      });
    }
  });

  return items;
}

// ─── eAuction PSB: Page-Based Pagination ─────────────────────────────────────

async function scrapeEAuctionPages(
  browser: any,
  page: any,
  statusFilter: string,
  startPage: number,
  maxPages: number,
  scrapeDetails: boolean,
): Promise<RawBaankNetItem[]> {
  log.info({ statusFilter, startPage, maxPages }, "Scraping eAuction PSB pages");

  const allItems: RawBaankNetItem[] = [];
  const seenAuctionIds = new Set<string>();
  let consecutiveStalePages = 0;

  // Jump to startPage if > 1
  if (startPage > 1) {
    log.info({ startPage }, `Jumping directly to page ${startPage}...`);
    await page.evaluate((targetPage: number) => {
      const pageInput = document.querySelector(
        "input[type='number'][id*='page'], input[type='number'][id*='goto'], " +
        "input[type='text'][id*='page'], input.page-input"
      ) as HTMLInputElement;
      if (pageInput) {
        pageInput.value = String(targetPage);
        pageInput.dispatchEvent(new Event("input", { bubbles: true }));
        pageInput.dispatchEvent(new Event("change", { bubbles: true }));
        const goBtn = pageInput.parentElement?.querySelector("button") as HTMLElement;
        if (goBtn) goBtn.click();
        else pageInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      }
    }, startPage);
    await randomDelay(BAANKNET_SCRAPE_DELAY_MS + 2000);
  }

  for (let pageNum = startPage; pageNum <= maxPages; pageNum++) {
    log.info({ page: pageNum }, "Extracting eAuction listings from page");

    const rawItems: RawBaankNetItem[] = await page.evaluate(
      extractEAuctionListingsFromDOM,
      KNOWN_LENDERS
    );

    if (rawItems.length === 0) {
      log.info({ page: pageNum }, "No items found on page. Reached end of catalog.");
      break;
    }

    const pageNewItems: RawBaankNetItem[] = [];
    const pageItemIds = rawItems
      .filter((item) => !seenAuctionIds.has(item.auctionId))
      .map((item) => item.auctionId);

    // Batch check which items already exist in DB
    const existingMap = new Map<string, { document_url: string | null; borrower_name: string | null }>();
    if (pageItemIds.length > 0) {
      const { data: existingRows } = await supabase
        .from("baanknet_auctions")
        .select("baanknet_auction_id, document_url, borrower_name")
        .in("baanknet_auction_id", pageItemIds);
      if (existingRows) {
        for (const row of existingRows) {
          existingMap.set(row.baanknet_auction_id, {
            document_url: row.document_url,
            borrower_name: row.borrower_name,
          });
        }
      }
    }

    for (const item of rawItems) {
      if (!seenAuctionIds.has(item.auctionId)) {
        seenAuctionIds.add(item.auctionId);

        const existing = existingMap.get(item.auctionId);
        if (existing) {
          item.documentUrl = existing.document_url || undefined;
          if (existing.borrower_name) item.borrowerName = existing.borrower_name;
        }

        pageNewItems.push(item);
        allItems.push(item);
      }
    }

    // Incremental Detail Scraping & DB Upsert PER PAGE
    if (pageNewItems.length > 0) {
      consecutiveStalePages = 0;
      if (scrapeDetails) {
        const toScrape = pageNewItems.filter(
          (item) => item.detailUrl && !item.borrowerName
        );
        if (toScrape.length > 0) {
          await scrapeDetailPages(browser, toScrape, BAANKNET_BASE_URL, BAANKNET_DETAIL_CONCURRENCY);
        }
      }

      const parsed = parseListings(pageNewItems, statusFilter.toLowerCase());
      await upsertListings(parsed);
      log.info(
        { page: pageNum, newSaved: parsed.length, totalSoFar: allItems.length },
        "Page scraped, enriched, and saved to database"
      );
    } else {
      consecutiveStalePages++;
      log.info({ page: pageNum, consecutiveStalePages }, "Page items already seen/saved in previous runs.");
      if (consecutiveStalePages >= 5) {
        log.info("5 consecutive pages with no new items encountered. Catalog is up to date or pagination completed. Stopping.");
        break;
      }
    }

    // Navigate to next page using page number input if available
    const navigated = await page.evaluate((nextPage: number) => {
      const pageInput = document.querySelector(
        "input[type='number'][id*='page'], input[type='number'][id*='goto'], " +
        "input[type='text'][id*='page'], input.page-input"
      ) as HTMLInputElement;

      if (pageInput) {
        pageInput.value = String(nextPage);
        pageInput.dispatchEvent(new Event("input", { bubbles: true }));
        pageInput.dispatchEvent(new Event("change", { bubbles: true }));

        const goBtn = pageInput.parentElement?.querySelector("button") as HTMLElement;
        if (goBtn) {
          goBtn.click();
          return true;
        }
        pageInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        return true;
      }

      const nextBtn = document.querySelector("#btnNext") as HTMLElement;
      if (nextBtn && !nextBtn.hasAttribute("disabled") && !(nextBtn as any).disabled) {
        nextBtn.click();
        return true;
      }

      const buttons = Array.from(document.querySelectorAll("button, a, .page-link"));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase().trim() || "";
        if (text === "next" || text === ">" || text.includes("next")) {
          if (!btn.hasAttribute("disabled") && !(btn as any).disabled) {
            (btn as HTMLElement).click();
            return true;
          }
        }
      }

      return false;
    }, pageNum + 1);

    if (!navigated) {
      log.info({ page: pageNum }, "Next button disabled or not found. Reached last page.");
      break;
    }

    await randomDelay(BAANKNET_SCRAPE_DELAY_MS);

    try {
      await page.waitForFunction(
        () => {
          const bodyText = document.body?.innerText || "";
          return bodyText.includes("Auction ID");
        },
        { timeout: 15000 }
      );
    } catch {
      log.warn({ page: pageNum + 1 }, "Timeout waiting for new page content");
    }
  }

  return allItems;
}

// ─── Property Listing: Infinite Scroll ───────────────────────────────────────

async function scrapePropertyListings(
  browser: any,
  page: any,
  maxScrolls: number,
  scrapeDetails: boolean,
): Promise<RawBaankNetItem[]> {
  log.info({ maxScrolls }, "Scraping Property Listings with infinite scroll");

  const targetUrl = `${BAANKNET_BASE_URL}${BAANKNET_PROPERTY_LISTING_PATH}`;
  log.info({ url: targetUrl }, "Navigating to Property Listing page...");

  await page.goto(targetUrl, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await randomDelay(5000);

  // Wait for property cards to load
  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.innerText || "";
        return bodyText.includes("Property ID") || bodyText.includes("View Details");
      },
      { timeout: 30000 }
    );
    log.info("Property listings detected on page.");
  } catch {
    log.warn("Timeout waiting for property listings. Attempting to proceed...");
  }

  const allItems: RawBaankNetItem[] = [];
  const seenPropertyIds = new Set<string>();
  let lastHeight = 0;
  let noNewContentCount = 0;

  for (let scroll = 1; scroll <= maxScrolls; scroll++) {
    // Extract current visible cards
    const rawCards = await page.evaluate(extractPropertyListingCards, KNOWN_LENDERS);

    let newCount = 0;
    for (const card of rawCards) {
      const uniqueId = card.bankPropertyId || card.auctionId;
      if (!uniqueId || seenPropertyIds.has(uniqueId)) continue;
      seenPropertyIds.add(uniqueId);

      allItems.push({
        auctionId: card.auctionId,
        bankPropertyId: card.bankPropertyId,
        title: card.title,
        reservePrice: card.reservePrice,
        bankName: card.bankName,
        location: card.location,
        address: "",
        startDate: card.startDate,
        endDate: card.endDate,
        detailUrl: card.detailUrl,
        carpetArea: card.carpetArea,
        furnishing: card.furnishing,
        possessionStatus: card.possessionStatus,
        actionType: card.actionType,
        district: card.district,
        inspectionStartDate: card.inspectionStartDate,
        inspectionEndDate: card.inspectionEndDate,
        emdEndDate: card.emdEndDate,
        thumbnailUrl: card.thumbnailUrl,
        photoUrls: card.photoUrls,
        auctionModule: "property",
      });
      newCount++;
    }

    log.info({
      scroll,
      cardsOnPage: rawCards.length,
      newItems: newCount,
      total: allItems.length,
    }, "Scroll cycle complete");

    // Check for end of content
    if (newCount === 0) {
      noNewContentCount++;
      if (noNewContentCount >= 3) {
        log.info("No new content after 3 scroll cycles. Stopping.");
        break;
      }
    } else {
      noNewContentCount = 0;
    }

    // Scroll to bottom
    const currentHeight = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return document.body.scrollHeight;
    });

    if (currentHeight === lastHeight && newCount === 0) {
      log.info("Page height unchanged and no new items. Reached bottom.");
      break;
    }
    lastHeight = currentHeight;

    // Wait for lazy-loaded content
    await randomDelay(BAANKNET_SCRAPE_DELAY_MS);
  }

  // Scrape detail pages for enrichment
  if (scrapeDetails) {
    const toEnrich = allItems.filter((item) => item.detailUrl);
    if (toEnrich.length > 0) {
      await scrapeDetailPages(browser, toEnrich, BAANKNET_BASE_URL, BAANKNET_DETAIL_CONCURRENCY);
    }
  }

  if (allItems.length > 0) {
    const parsed = parseListings(allItems, "upcoming");
    await upsertListings(parsed);
  }

  return allItems;
}

// ─── IBC eAuction: Separate Subdomain ────────────────────────────────────────

async function scrapeIBCAuctions(
  browser: any,
  startPage: number,
  maxPages: number,
  scrapeDetails: boolean,
): Promise<RawBaankNetItem[]> {
  log.info({ startPage, maxPages }, "Scraping IBC eAuction (ibbi.baanknet.com)");

  // IBC uses a separate subdomain — needs its own page/session
  const ibcPage = await browser.newPage();
  await ibcPage.setUserAgent(DEFAULT_USER_AGENT);
  await ibcPage.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
  });

  // Override webdriver detection
  await ibcPage.evaluateOnNewDocument(() => {
    (window as any).__name = (window as any).__name || ((fn: any) => fn);
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const allItems: RawBaankNetItem[] = [];
  const seenIds = new Set<string>();

  try {
    const targetUrl = `${BAANKNET_IBC_BASE_URL}${BAANKNET_IBC_LISTING_PATH}`;
    log.info({ url: targetUrl }, "Navigating to IBC eAuction...");

    await ibcPage.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await randomDelay(5000);

    // Wait for content
    try {
      await ibcPage.waitForFunction(
        () => {
          const bodyText = document.body?.innerText || "";
          return bodyText.includes("Asset") || bodyText.includes("Reserve");
        },
        { timeout: 30000 }
      );
      log.info("IBC listings detected.");
    } catch {
      log.warn("Timeout waiting for IBC listings. Page may be empty or loading slowly.");
    }

    for (let pageNum = startPage; pageNum <= maxPages; pageNum++) {
      const rawCards = await ibcPage.evaluate(extractIBCListingCards, KNOWN_LENDERS);

      const pageNewItems: RawBaankNetItem[] = [];
      for (const card of rawCards) {
        if (seenIds.has(card.auctionId)) continue;
        seenIds.add(card.auctionId);

        const itemObj: RawBaankNetItem = {
          auctionId: card.auctionId,
          bankPropertyId: "",
          title: card.title,
          reservePrice: card.reservePrice,
          bankName: card.bankName,
          location: card.location,
          address: "",
          startDate: card.startDate,
          endDate: card.endDate,
          detailUrl: card.detailUrl,
          actionType: "IBC",
          auctionModule: "ibc",
        };
        pageNewItems.push(itemObj);
        allItems.push(itemObj);
      }

      if (pageNewItems.length > 0) {
        if (scrapeDetails) {
          const toEnrich = pageNewItems.filter(item => item.detailUrl);
          if (toEnrich.length > 0) {
            await scrapeDetailPages(browser, toEnrich, BAANKNET_IBC_BASE_URL, BAANKNET_DETAIL_CONCURRENCY);
          }
        }
        const parsed = parseListings(pageNewItems, "upcoming");
        await upsertListings(parsed);
        log.info({ page: pageNum, saved: parsed.length, total: allItems.length }, "IBC page scraped and saved to DB");
      }

      if (rawCards.length === 0) {
        log.info({ page: pageNum }, "No IBC items found. Reached last page.");
        break;
      }

      // Navigate to next page
      const navigated = await ibcPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, a, .page-link"));
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase().trim() || "";
          if (text === "next" || text === ">" || text.includes("next")) {
            if (!btn.hasAttribute("disabled") && !(btn as any).disabled) {
              (btn as HTMLElement).click();
              return true;
            }
          }
        }
        return false;
      });

      if (!navigated) {
        log.info("IBC pagination: reached last page.");
        break;
      }

      await randomDelay(BAANKNET_SCRAPE_DELAY_MS);
    }
  } catch (err: any) {
    log.error({ error: err.message }, "IBC scraper error");
  } finally {
    await ibcPage.close().catch(() => {});
  }

  return allItems;
}

// ─── Status Tab Click ────────────────────────────────────────────────────────

async function clickStatusTab(page: any, statusLabel: string): Promise<boolean> {
  log.info({ status: statusLabel }, "Clicking status tab...");

  const result = await page.evaluate((label: string) => {
    const tabs = Array.from(
      document.querySelectorAll(
        "button, a, [role='tab'], .mat-tab-label, .nav-link, [class*='tab'], li"
      )
    );

    const foundTabsInfo: { tagName: string; className: string; text: string }[] = [];

    for (const tab of tabs) {
      const text = (tab as HTMLElement).innerText?.trim().toUpperCase() || "";
      if (text.length > 0 && text.length < 50) {
        foundTabsInfo.push({
          tagName: tab.tagName,
          className: tab.className,
          text: (tab as HTMLElement).innerText?.trim() || "",
        });
      }
      if (text.startsWith(label.toUpperCase())) {
        (tab as HTMLElement).click();
        return { clicked: true, foundTabsInfo };
      }
    }
    return { clicked: false, foundTabsInfo };
  }, statusLabel);

  if (result.clicked) {
    log.info({ status: statusLabel }, "Status tab clicked. Waiting for content...");
    await randomDelay(BAANKNET_SCRAPE_DELAY_MS + 2000);
    return true;
  } else {
    const uniqTabs = Array.from(
      new Set(result.foundTabsInfo.map((t: any) => `${t.tagName}.${t.className.replace(/\s+/g, '.')} -> "${t.text}"`))
    ).slice(0, 20);
    log.warn(
      { status: statusLabel, availableTabs: uniqTabs },
      "Could not find status tab"
    );
    return false;
  }
}

// ─── Database Upsert ─────────────────────────────────────────────────────────

async function upsertListings(listings: ReturnType<typeof parseListings>): Promise<void> {
  if (listings.length === 0) {
    log.info("No listings to upsert.");
    return;
  }

  // Deduplicate input by baanknet_auction_id
  const seenIds = new Set<string>();
  const uniqueListings = listings.filter((l) => {
    if (seenIds.has(l.baanknet_auction_id)) return false;
    seenIds.add(l.baanknet_auction_id);
    return true;
  });

  // Check for existing records (chunk .in() queries to avoid Supabase limit)
  const newIds = uniqueListings.map((l) => l.baanknet_auction_id);
  const existingSet = new Set<string>();
  const inChunkSize = 500;
  for (let i = 0; i < newIds.length; i += inChunkSize) {
    const idChunk = newIds.slice(i, i + inChunkSize);
    const { data: existing } = await supabase
      .from("baanknet_auctions")
      .select("baanknet_auction_id")
      .in("baanknet_auction_id", idChunk);
    if (existing) {
      for (const row of existing) {
        existingSet.add(row.baanknet_auction_id);
      }
    }
  }

  const newListings = uniqueListings.filter((l) => !existingSet.has(l.baanknet_auction_id));
  const updatedListings = uniqueListings.filter((l) => existingSet.has(l.baanknet_auction_id));

  // Insert new records in chunks
  if (newListings.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < newListings.length; i += chunkSize) {
      const chunk = newListings.slice(i, i + chunkSize);
      const dbChunk = chunk.map((item) => {
        // Separate photo_urls from the DB record (stored in separate table)
        const { photo_urls, ...dbFields } = item;
        return {
          ...dbFields,
          reserve_price_value: dbFields.reserve_price_value ?? null,
        };
      });
      const { error } = await supabase.from("baanknet_auctions").insert(dbChunk);

      if (error) {
        log.error(
          { error: error.message, chunkStart: i, chunkSize: chunk.length },
          "Failed to insert BaankNet listings chunk"
        );
      } else {
        log.info(
          { inserted: chunk.length, batch: Math.floor(i / chunkSize) + 1 },
          "Inserted BaankNet listings batch"
        );
      }
    }

    // Insert photos for new listings
    const photoInserts: { baanknet_auction_id: string; photo_url: string; display_order: number }[] = [];
    for (const listing of newListings) {
      if (listing.photo_urls && listing.photo_urls.length > 0) {
        listing.photo_urls.forEach((url, idx) => {
          photoInserts.push({
            baanknet_auction_id: listing.baanknet_auction_id,
            photo_url: url,
            display_order: idx,
          });
        });
      }
    }

    if (photoInserts.length > 0) {
      const photoChunkSize = 200;
      for (let i = 0; i < photoInserts.length; i += photoChunkSize) {
        const chunk = photoInserts.slice(i, i + photoChunkSize);
        const { error } = await supabase.from("baanknet_auction_photos").insert(chunk);
        if (error) {
          log.error({ error: error.message }, "Failed to insert photos batch");
        }
      }
      log.info({ count: photoInserts.length }, "Inserted auction photos");
    }
  }

  // Update existing records
  for (const listing of updatedListings) {
    const { error } = await supabase
      .from("baanknet_auctions")
      .update({
        auction_status: listing.auction_status,
        auction_start_date: listing.auction_start_date,
        auction_end_date: listing.auction_end_date,
        reserve_price_text: listing.reserve_price_text,
        reserve_price_value: listing.reserve_price_value,
        // Update detail fields if they were freshly scraped
        ...(listing.carpet_area ? { carpet_area: listing.carpet_area } : {}),
        ...(listing.carpet_area_sqft ? { carpet_area_sqft: listing.carpet_area_sqft } : {}),
        ...(listing.furnishing ? { furnishing: listing.furnishing } : {}),
        ...(listing.possession_status ? { possession_status: listing.possession_status } : {}),
        ...(listing.action_type ? { action_type: listing.action_type } : {}),
        ...(listing.district ? { district: listing.district } : {}),
        ...(listing.borrower_name ? { borrower_name: listing.borrower_name } : {}),
        ...(listing.property_description ? { property_description: listing.property_description } : {}),
        ...(listing.thumbnail_url ? { thumbnail_url: listing.thumbnail_url } : {}),
        ...(listing.photo_count ? { photo_count: listing.photo_count } : {}),
        ...(listing.inspection_start_date ? { inspection_start_date: listing.inspection_start_date } : {}),
        ...(listing.inspection_end_date ? { inspection_end_date: listing.inspection_end_date } : {}),
        ...(listing.emd_end_date ? { emd_end_date: listing.emd_end_date } : {}),
      })
      .eq("baanknet_auction_id", listing.baanknet_auction_id);

    if (error) {
      log.warn(
        { id: listing.baanknet_auction_id, error: error.message },
        "Failed to update existing BaankNet listing"
      );
    }
  }

  log.info(
    { newInserted: newListings.length, updated: updatedListings.length },
    "BaankNet database upsert complete"
  );

  // Record daily stats
  const today = new Date().toISOString().split("T")[0];
  if (newListings.length > 0) {
    const statsMap: Record<string, number> = {};
    newListings.forEach((l) => {
      const cat = l.category_name || "Uncategorized";
      statsMap[cat] = (statsMap[cat] || 0) + 1;
    });

    for (const [category, count] of Object.entries(statsMap)) {
      const { data: existingStat } = await supabase
        .from("category_daily_stats")
        .select("id, items_added")
        .eq("date", today)
        .eq("category_name", category)
        .maybeSingle();

      if (existingStat) {
        await supabase
          .from("category_daily_stats")
          .update({ items_added: existingStat.items_added + count })
          .eq("id", existingStat.id);
      } else {
        await supabase.from("category_daily_stats").insert({
          date: today,
          category_name: category,
          items_added: count,
        });
      }
    }

    log.info({ categories: Object.keys(statsMap).length }, "Daily stats recorded");
  }
}

// ─── Browser Launch ──────────────────────────────────────────────────────────

async function launchBrowser(headful: boolean) {
  log.info({ headful }, "Launching stealth browser...");
  return puppeteer.launch({
    headless: !headful,
    defaultViewport: { width: 1366, height: 768 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });
}

async function setupPage(browser: any) {
  const page = await browser.newPage();
  await page.setUserAgent(DEFAULT_USER_AGENT);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  });

  await page.evaluateOnNewDocument(() => {
    (window as any).__name = (window as any).__name || ((fn: any) => fn);
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });

  return page;
}

// ─── Main Scraper Entry Point ────────────────────────────────────────────────

async function executeBaankNetScraper(): Promise<void> {
  const { modules, statusFilters, headful, maxPages, startPage, scrapeDetails } = parseCliArgs();

  log.info(
    { modules, statusFilters, headful, maxPages, startPage, scrapeDetails },
    "Starting BaankNet multi-module scraper"
  );

  // Step 1: Cleanup expired auctions
  await cleanupExpiredAuctions();

  // Step 2: Launch browser
  const browser = await launchBrowser(headful);

  let totalScraped = 0;

  try {
    // ── Module 1: eAuction PSB ──────────────────────────────────────────
    if (modules.includes("eauction")) {
      log.info("═══ Starting Module: eAuction PSB ═══");
      const page = await setupPage(browser);

      try {
        // Establish session
        const sessionUrl = `${BAANKNET_BASE_URL}/eauction-psb/`;
        log.info({ url: sessionUrl }, "Establishing session with eAuction portal...");
        await page.goto(sessionUrl, { waitUntil: "networkidle2", timeout: 45000 });
        await randomDelay(3000);

        // Navigate to listings
        const targetUrl = `${BAANKNET_BASE_URL}${BAANKNET_EAUCTION_PATH}`;
        log.info({ url: targetUrl }, "Navigating to eAuction listings...");
        await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

        // Wait for Angular bootstrap
        log.info("Waiting for Angular app to render...");
        await randomDelay(5000);

        try {
          await page.waitForFunction(
            () => document.body?.innerText?.includes("Auction ID"),
            { timeout: 30000 }
          );
          log.info("eAuction listings detected.");
        } catch {
          log.warn("Timeout waiting for eAuction listings. Proceeding...");
        }

        // Scrape each status tab
        for (const statusFilter of statusFilters) {
          log.info({ status: statusFilter }, "Processing status tab...");
          await clickStatusTab(page, statusFilter);
          await randomDelay(3000);

          const rawItems = await scrapeEAuctionPages(
            browser, page, statusFilter, startPage, maxPages, scrapeDetails
          );

          totalScraped += rawItems.length;

          log.info({ status: statusFilter, count: rawItems.length }, "Tab processing complete");

          if (statusFilters.indexOf(statusFilter) < statusFilters.length - 1) {
            await randomDelay(BAANKNET_SCRAPE_DELAY_MS);
          }
        }
      } catch (err: any) {
        log.error({ error: err.message }, "eAuction module error");
      } finally {
        await page.close().catch(() => {});
      }
    }

    // ── Module 2: Property Listings ─────────────────────────────────────
    if (modules.includes("property")) {
      log.info("═══ Starting Module: Property Listings ═══");
      const page = await setupPage(browser);

      try {
        const rawItems = await scrapePropertyListings(
          browser, page, BAANKNET_MAX_SCROLL_CYCLES, scrapeDetails
        );

        totalScraped += rawItems.length;
        log.info({ count: rawItems.length }, "Property listings module complete");
      } catch (err: any) {
        log.error({ error: err.message }, "Property Listing module error");
      } finally {
        await page.close().catch(() => {});
      }
    }

    // ── Module 3: IBC eAuction ──────────────────────────────────────────
    if (modules.includes("ibc")) {
      log.info("═══ Starting Module: IBC eAuction ═══");

      try {
        const rawItems = await scrapeIBCAuctions(browser, startPage, maxPages, scrapeDetails);

        totalScraped += rawItems.length;
        log.info({ count: rawItems.length }, "IBC eAuction module complete");
      } catch (err: any) {
        log.error({ error: err.message }, "IBC eAuction module error");
      }
    }
  } catch (error: any) {
    log.error({ error: error.message, stack: error.stack }, "BaankNet scraper error");
  } finally {
    if (browser) {
      await browser.close();
    }
    log.info(
      { totalScraped },
      "BaankNet multi-module scraper execution complete. Browser closed."
    );

    if (totalScraped > 0) {
      const { error: auditError } = await supabase.from("audit_logs").insert({
        action: "baanknet_auction_scraped",
        entity_type: "baanknet_auction",
        details: {
          total_scraped: totalScraped.toString(),
          modules: modules.join(","),
          timestamp: new Date().toISOString(),
        },
      });
      if (auditError) {
        log.error({ error: auditError.message }, "Failed to write scraper completion audit log");
      }
    }
  }
}

// ─── Execute ─────────────────────────────────────────────────────────────────

executeBaankNetScraper();
