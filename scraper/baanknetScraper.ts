/**
 * BaankNet eAuction Scraper
 *
 * Scrapes bank-seized property auctions from baanknet.com (PSB Alliance).
 * Uses Puppeteer with stealth plugin to navigate the Angular SPA,
 * extract listing data from the rendered DOM, and upsert into Supabase.
 *
 * Unlike MSTC, BaankNet has no CAPTCHA — this scraper runs fully headless.
 *
 * Usage:
 *   npx tsx scraper/baanknetScraper.ts
 *   npx tsx scraper/baanknetScraper.ts --status=UPCOMING
 *   npx tsx scraper/baanknetScraper.ts --status=LIVE
 *   npx tsx scraper/baanknetScraper.ts --headful   (visible browser for debugging)
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
  BAANKNET_SCRAPE_DELAY_MS,
  BAANKNET_MAX_SCROLL_CYCLES,
  BAANKNET_STATUS_FILTERS,
  DEFAULT_USER_AGENT,
} from "./config.js";
import { logger } from "./utils/logger.js";
import {
  parseListings,
  type RawBaankNetItem,
} from "./parsers/baanknetParser.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

puppeteer.use(StealthPlugin());

const log = logger.child({ module: "baanknetScraper" });

// ─── Supabase Client ─────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  log.fatal("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseCliArgs(): { statusFilters: string[]; headful: boolean } {
  const args = process.argv.slice(2);
  let headful = false;
  let statusFilters = [...BAANKNET_STATUS_FILTERS];

  for (const arg of args) {
    if (arg === "--headful") {
      headful = true;
    }
    if (arg.startsWith("--status=")) {
      statusFilters = arg.replace("--status=", "").split(",");
    }
  }

  return { statusFilters, headful };
}

// ─── Random Delay (anti-detection) ───────────────────────────────────────────

function randomDelay(baseMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * baseMs * 0.5);
  const delay = baseMs + jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
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

  // Delete records
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

// ─── DOM Extraction (runs inside Puppeteer page context) ─────────────────────

/**
 * This function is serialized and run inside the browser.
 * It extracts all visible auction listing cards from the BaankNet eAuction page.
 */
function extractListingsFromDOM(): RawBaankNetItem[] {
  const items: RawBaankNetItem[] = [];

  // Each auction listing is a card/div with auction details
  // Based on observed DOM: title, auction ID, bank property ID, reserve price,
  // bank name, location, address, start/end dates
  const cards = document.querySelectorAll(
    ".card, .auction-card, .listing-card, [class*='auction'], [class*='listing']"
  );

  // If no cards found via class selectors, try a more generic approach
  // by looking for repeated content blocks containing "Auction ID:"
  const allText = document.body?.innerText || "";

  if (cards.length === 0 || !allText.includes("Auction ID")) {
    // Fallback: parse from the full page text structure
    // BaankNet renders listings with a numbered pattern like "1) Title..."
    const listingBlocks = document.querySelectorAll(
      ".mat-card, .mat-expansion-panel, .cdk-accordion-item, " +
      "[class*='result'], [class*='property'], [class*='item']"
    );

    const effectiveCards = listingBlocks.length > 0 ? listingBlocks : cards;

    effectiveCards.forEach((card) => {
      const text = (card as HTMLElement).innerText || "";
      if (!text.includes("Auction ID")) return;

      const auctionIdMatch = text.match(/Auction\s*ID\s*:\s*(\d+)/i);
      const bankPropIdMatch = text.match(/Bank\s*Property\s*ID\s*:\s*(\S+)/i);
      const reservePriceMatch = text.match(/Reserve\s*Price\s*:\s*([₹\s\d.,]+(?:Lakh|Crore|Lac)?)/i);
      const bankMatch = text.match(/(?:🏛|Bank\s*(?:Name)?)\s*:?\s*([A-Za-z\s]+(?:Bank|of\s+\w+)(?:\s+of\s+\w+)?)/i);

      // Extract title (first meaningful line, often "N) Title Text")
      const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      let title = "";
      for (const line of lines) {
        const titleMatch = line.match(/^\d+\)\s*(.+)/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          break;
        }
      }
      if (!title && lines.length > 0) {
        title = lines[0];
      }

      // Extract location line (State, City, Pincode format)
      let locationStr = "";
      for (const line of lines) {
        if (/^\w+,\s*\w+.*\d{6}/.test(line) || /^\w+,\s*\w+,\s*\w+/.test(line)) {
          locationStr = line;
          break;
        }
      }

      // Extract address
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

      // Extract dates
      const startMatch = text.match(/Start\s*Date\s*:\s*([\d\-/]+\s+[\d:]+)/i);
      const endMatch = text.match(/End\s*Date\s*:\s*([\d\-/]+\s+[\d:]+)/i);

      if (auctionIdMatch) {
        items.push({
          auctionId: auctionIdMatch[1],
          bankPropertyId: bankPropIdMatch ? bankPropIdMatch[1] : "",
          title: title || "Bank Auction Property",
          reservePrice: reservePriceMatch ? reservePriceMatch[1].trim() : "",
          bankName: bankMatch ? bankMatch[1].trim() : "Unknown Bank",
          location: locationStr,
          address: address,
          startDate: startMatch ? startMatch[1] : "",
          endDate: endMatch ? endMatch[1] : "",
        });
      }
    });

    return items;
  }

  // Primary path: iterate over found cards
  cards.forEach((card) => {
    const text = (card as HTMLElement).innerText || "";
    if (!text.includes("Auction ID")) return;

    const auctionIdMatch = text.match(/Auction\s*ID\s*:\s*(\d+)/i);
    const bankPropIdMatch = text.match(/Bank\s*Property\s*ID\s*:\s*(\S+)/i);
    const reservePriceMatch = text.match(/Reserve\s*Price\s*:\s*([₹\s\d.,]+(?:Lakh|Crore|Lac)?)/i);
    const bankMatch = text.match(/(?:🏛|Bank\s*(?:Name)?)\s*:?\s*([A-Za-z\s]+(?:Bank|of\s+\w+)(?:\s+of\s+\w+)?)/i);

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

    let locationStr = "";
    for (const line of lines) {
      if (/^\w+,\s*\w+.*\d{6}/.test(line) || /^\w+,\s*\w+,\s*\w+/.test(line)) {
        locationStr = line;
        break;
      }
    }

    let address = "";
    for (const line of lines) {
      if (line.includes("ROAD") || line.includes("STREET") || line.includes("NAGAR") ||
          line.includes("COLONY") || line.includes("SECTOR")) {
        if (!line.includes("Auction") && !line.includes("Date") && !line.includes("Price")) {
          address = line;
          break;
        }
      }
    }

    const startMatch = text.match(/Start\s*Date\s*:\s*([\d\-/]+\s+[\d:]+)/i);
    const endMatch = text.match(/End\s*Date\s*:\s*([\d\-/]+\s+[\d:]+)/i);

    if (auctionIdMatch) {
      items.push({
        auctionId: auctionIdMatch[1],
        bankPropertyId: bankPropIdMatch ? bankPropIdMatch[1] : "",
        title: title || "Bank Auction Property",
        reservePrice: reservePriceMatch ? reservePriceMatch[1].trim() : "",
        bankName: bankMatch ? bankMatch[1].trim() : "Unknown Bank",
        location: locationStr,
        address: address,
        startDate: startMatch ? startMatch[1] : "",
        endDate: endMatch ? endMatch[1] : "",
      });
    }
  });

  return items;
}

// ─── Scroll-to-Load Handler ─────────────────────────────────────────────────

async function scrollToLoadAll(
  page: any,
  maxCycles: number
): Promise<void> {
  log.info("Scrolling to load all listings...");

  let previousHeight = 0;
  let stableCount = 0;

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    if (currentHeight === previousHeight) {
      stableCount++;
      if (stableCount >= 3) {
        log.info(
          { cycles: cycle, height: currentHeight },
          "Page height stabilized — all listings loaded"
        );
        break;
      }
    } else {
      stableCount = 0;
    }

    previousHeight = currentHeight;

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await randomDelay(BAANKNET_SCRAPE_DELAY_MS);

    // Also try clicking "Load More" / "Show More" buttons if present
    try {
      const loadMoreClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, a"));
        for (const btn of buttons) {
          const text = (btn as HTMLElement).innerText?.toLowerCase() || "";
          if (
            text.includes("load more") ||
            text.includes("show more") ||
            text.includes("next")
          ) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (loadMoreClicked) {
        log.info({ cycle }, "Clicked 'Load More' button");
        await randomDelay(BAANKNET_SCRAPE_DELAY_MS);
      }
    } catch {
      // Button not found, continue scrolling
    }

    if (cycle % 10 === 0 && cycle > 0) {
      const itemCount = await page.evaluate(() => {
        const text = document.body.innerText || "";
        const matches = text.match(/Auction\s*ID\s*:/gi);
        return matches ? matches.length : 0;
      });
      log.info({ cycle, visibleItems: itemCount }, "Scroll progress");
    }
  }
}

// ─── Status Tab Click ────────────────────────────────────────────────────────

async function clickStatusTab(page: any, statusLabel: string): Promise<boolean> {
  log.info({ status: statusLabel }, "Clicking status tab...");

  const result = await page.evaluate((label: string) => {
    // Look for tab buttons / mat-tab labels
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

  // Deduplicate input list by baanknet_auction_id to prevent duplicates in the same batch
  const seenIds = new Set<string>();
  const uniqueListings = listings.filter((l) => {
    if (seenIds.has(l.baanknet_auction_id)) return false;
    seenIds.add(l.baanknet_auction_id);
    return true;
  });

  // Check for existing records
  const newIds = uniqueListings.map((l) => l.baanknet_auction_id);
  const { data: existing } = await supabase
    .from("baanknet_auctions")
    .select("baanknet_auction_id")
    .in("baanknet_auction_id", newIds);

  const existingSet = new Set(existing?.map((a) => a.baanknet_auction_id) || []);
  const newListings = uniqueListings.filter((l) => !existingSet.has(l.baanknet_auction_id));
  const updatedListings = uniqueListings.filter((l) => existingSet.has(l.baanknet_auction_id));

  // Insert new records
  if (newListings.length > 0) {
    // Batch insert in chunks of 100 to avoid payload limits
    const chunkSize = 100;
    for (let i = 0; i < newListings.length; i += chunkSize) {
      const chunk = newListings.slice(i, i + chunkSize);
      // Map null → undefined for Supabase column compatibility
      const dbChunk = chunk.map((item) => ({
        ...item,
        reserve_price_value: item.reserve_price_value ?? undefined,
      }));
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
  }

  // Update existing records (status, dates may have changed)
  for (const listing of updatedListings) {
    const { error } = await supabase
      .from("baanknet_auctions")
      .update({
        auction_status: listing.auction_status,
        auction_start_date: listing.auction_start_date,
        auction_end_date: listing.auction_end_date,
        reserve_price_text: listing.reserve_price_text,
        reserve_price_value: listing.reserve_price_value,
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

// ─── Main Scraper Entry Point ────────────────────────────────────────────────

async function executeBaankNetScraper(): Promise<void> {
  const { statusFilters, headful } = parseCliArgs();

  log.info(
    { statusFilters, headful },
    "Starting BaankNet eAuction scraper"
  );

  // Step 1: Cleanup expired auctions
  await cleanupExpiredAuctions();

  // Step 2: Launch browser
  log.info("Launching stealth browser...");
  const browser = await puppeteer.launch({
    headless: !headful,
    defaultViewport: { width: 1366, height: 768 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });

  const page = await browser.newPage();

  // Stealth: realistic user agent and extra headers
  await page.setUserAgent(DEFAULT_USER_AGENT);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  });

  // Stealth: override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
    // Override plugins to look like a real browser
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  let totalScraped = 0;

  try {
    // First, establish session by visiting the home portal to set cookies
    const sessionUrl = `${BAANKNET_BASE_URL}/eauction-psb/`;
    log.info({ url: sessionUrl }, "Establishing session with BaankNet portal...");
    await page.goto(sessionUrl, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });
    await randomDelay(3000);

    // Now, navigate to the actual eAuction listings page
    const targetUrl = `${BAANKNET_BASE_URL}/eauction-psb/eproc-listing`;
    log.info({ url: targetUrl }, "Navigating to BaankNet eAuction listings page...");

    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait for Angular to bootstrap and render content
    log.info("Waiting for Angular app to render...");
    await randomDelay(5000);

    // Wait for auction content to appear
    try {
      await page.waitForFunction(
        () => {
          const bodyText = document.body?.innerText || "";
          return bodyText.includes("Auction ID");
        },
        { timeout: 30000 }
      );
      log.info("Auction listings detected on page.");
    } catch {
      log.warn("Timeout waiting for auction listings. Attempting to proceed...");
    }

    // Step 3: Scrape each status tab
    for (const statusFilter of statusFilters) {
      log.info({ status: statusFilter }, "Processing status tab...");

      // Click the appropriate tab
      await clickStatusTab(page, statusFilter);

      // Wait for content to load after tab switch
      await randomDelay(3000);

      // Scroll to load all listings
      await scrollToLoadAll(page, BAANKNET_MAX_SCROLL_CYCLES);

      // Extract listings from DOM
      log.info("Extracting listings from DOM...");
      const rawItems: RawBaankNetItem[] = await page.evaluate(
        extractListingsFromDOM
      );

      log.info(
        { status: statusFilter, rawCount: rawItems.length },
        "Raw items extracted from DOM"
      );

      if (rawItems.length === 0) {
        log.warn(
          { status: statusFilter },
          "No items found for this status tab. Dumping page text for diagnostics..."
        );

        // Diagnostic: log first 500 chars of page text
        const pageText = await page.evaluate(
          () => (document.body?.innerText || "").substring(0, 500)
        );
        log.info({ pageTextPreview: pageText }, "Page text preview");
        continue;
      }

      // Parse and validate extracted data
      const parsed = parseListings(rawItems, statusFilter.toLowerCase());

      // Upsert into database
      await upsertListings(parsed);

      totalScraped += parsed.length;

      log.info(
        { status: statusFilter, count: parsed.length },
        "Tab scraping complete"
      );

      // Delay between tabs
      if (statusFilters.indexOf(statusFilter) < statusFilters.length - 1) {
        await randomDelay(BAANKNET_SCRAPE_DELAY_MS);
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
      "BaankNet scraper execution complete. Browser closed."
    );

    if (totalScraped > 0) {
      const { error: auditError } = await supabase.from("audit_logs").insert({
        action: "baanknet_auction_scraped",
        entity_type: "baanknet_auction",
        details: {
          total_scraped: totalScraped.toString(),
          timestamp: new Date().toISOString()
        }
      });
      if (auditError) {
        log.error({ error: auditError.message }, "Failed to write scraper completion audit log");
      }
    }
  }
}

// ─── Execute ─────────────────────────────────────────────────────────────────

executeBaankNetScraper();
