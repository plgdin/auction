/**
 * GeM Portal Forward Auction Scraper
 *
 * Scrapes active government asset auctions from the GeM Portal (gem.gov.in).
 * Uses Puppeteer with stealth plugin. Fully headless by default.
 *
 * Usage:
 *   npx tsx scraper/gemScraper.ts
 *   npx tsx scraper/gemScraper.ts --headful
 *   npx tsx scraper/gemScraper.ts --max-pages=5
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  DEFAULT_USER_AGENT,
} from "./config.js";
import { logger } from "./utils/logger.js";
import {
  parseLocation,
  parseGeMDate,
  parseReservePrice,
  parseIndianPriceRange,
  normalizeGeMAuctionStatus,
  classifyGeMListing,
  type GeMListing,
} from "./parsers/gemParser.js";
import { gemListingSchema } from "./schemas/gemListingSchema.js";
import { computeListingsFingerprint, isPaginationStalled } from "./utils/common/fingerprint.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

puppeteer.use(StealthPlugin());

const log = logger.child({ module: "gemScraper" });

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
  headful: boolean;
  maxPages: number;
  startPage: number;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let headful = false;
  let maxPages = 100; // Default limit (covers all pages up to 1000 records)
  let startPage = 1;

  for (const arg of args) {
    if (arg === "--headful") headful = true;
    if (arg.startsWith("--max-pages=")) {
      maxPages = parseInt(arg.replace("--max-pages=", ""), 10);
    }
    if (arg.startsWith("--start-page=")) {
      startPage = parseInt(arg.replace("--start-page=", ""), 10);
    }
  }

  return { headful, maxPages, startPage };
}

// ─── Delay Utility ───────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  const jitter = Math.floor(Math.random() * ms * 0.3);
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

// ─── Expired Auction Cleanup ─────────────────────────────────────────────────

async function cleanupExpiredAuctions(): Promise<void> {
  log.info("Checking for expired GeM auctions...");

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: expired, error: fetchError } = await supabase
    .from("gem_auctions")
    .select("id, gem_auction_id, auction_end_date")
    .lt("auction_end_date", oneWeekAgo.toISOString());

  if (fetchError) {
    log.error({ error: fetchError.message }, "Failed to fetch expired GeM auctions");
    return;
  }

  if (!expired || expired.length === 0) {
    log.info("No expired GeM auctions to clean up.");
    return;
  }

  log.info({ count: expired.length }, "Found expired GeM auctions. Cleaning up...");

  // Write audit logs
  const logEntries = expired.map((auc) => ({
    action: "gem_auction_deleted",
    entity_type: "gem_auction",
    details: {
      gem_auction_id: auc.gem_auction_id as string,
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
    .from("gem_auctions")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    log.error({ error: deleteError.message }, "Failed to delete expired GeM auctions from db");
  } else {
    log.info({ count: expired.length }, "Expired GeM auctions cleanup complete");
  }
}

// ─── DOM Ingestion (Evaluates inside Puppeteer context) ──────────────────────

function extractGeMListingsFromDOM(): any[] {
  const items: any[] = [];
  
  // Find all brief/title links which indicate an auction item
  const briefLinks = document.querySelectorAll("a.brief.text-wrap");
  
  briefLinks.forEach((linkEl) => {
    const briefLink = linkEl as HTMLAnchorElement;
    const title = briefLink.innerText.trim();
    const href = briefLink.getAttribute("href") || "";
    
    // Find container element (typically card or list-item row)
    const container = briefLink.closest(".eproc-listing-main") || 
                      briefLink.closest(".x-auction-card") || 
                      briefLink.closest(".card") || 
                      briefLink.closest("tr") || 
                      briefLink.parentElement?.parentElement?.parentElement || 
                      briefLink.parentElement?.parentElement;
                      
    if (!container) return;
    
    const containerText = (container as HTMLElement).innerText || "";
    
    // Extract Auction ID from text or link
    let auctionId = "";
    const idMatch = href.match(/\/view-auction-notice\/(\d+)/i) || href.match(/\/eauction-download-document\/(\d+)/i);
    if (idMatch) {
      auctionId = idMatch[1];
    } else {
      const textIdMatch = containerText.match(/Auction\s*ID\s*:\s*(\d+)/i);
      if (textIdMatch) auctionId = textIdMatch[1];
    }
    
    if (!auctionId) return; // Skip if we can't extract the identifier
    
    // Extract Location text preceding the View More link
    let locationText = "";
    const locLink = container.querySelector("a[href*='view-project-location']");
    if (locLink) {
      locationText = locLink.previousSibling?.textContent?.trim() || 
                     locLink.parentElement?.textContent?.replace("View More", "").trim() || "";
    } else {
      // Fallback location pattern search
      const locMatch = containerText.match(/Location\s*:\s*([^\n]+)/i);
      if (locMatch) locationText = locMatch[1].trim();
    }
    
    // Extract Dates
    const startMatch = containerText.match(/Start\s*Date\s*:\s*([\d\-/: ]+)/i);
    const endMatch = containerText.match(/End\s*Date\s*:\s*([\d\-/: ]+)/i);
    
    // Extract Organization details (Ministry, Department, Organisation)
    let ministry = "";
    let department = "";
    let organisation = "";
    
    const minMatch = containerText.match(/Ministry\s*:\s*([^\n|]+)/i);
    const deptMatch = containerText.match(/Department\s*:\s*([^\n|]+)/i);
    const orgMatch = containerText.match(/Organisation\s*:\s*([^\n|]+)/i);
    
    if (minMatch) ministry = minMatch[1].trim();
    if (deptMatch) department = deptMatch[1].trim();
    if (orgMatch) organisation = orgMatch[1].trim();
    
    // Fallback: If not explicitly labeled, search lines
    if (!organisation) {
      const lines = containerText.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.toLowerCase().includes("ltd") || line.toLowerCase().includes("limited") || line.toLowerCase().includes("corporation") || line.toLowerCase().includes("india")) {
          organisation = line;
          break;
        }
      }
    }
    
    // Document Download Links (NIT, Schedule of Lots, Auction Notice)
    const allDocUrls: string[] = [];
    const docLinks = container.querySelectorAll("a[href*='eauction-download-document'], a[href*='view-auction-notice'], a[href*='download'], a[href*='notice'], a[href*='document'], a[href*='.pdf']");
    docLinks.forEach((dLink) => {
      const href = (dLink as HTMLAnchorElement).getAttribute("href") || "";
      if (href && !allDocUrls.includes(href)) {
        allDocUrls.push(href);
      }
    });
    const primaryDocUrl = allDocUrls[0] || `/eprocure/eauction-download-document/${auctionId}`;

    // Reserve Price / Starting price
    let reservePriceText = "";
    const priceMatch = containerText.match(/(?:Reserve|Starting)\s*Price\s*:\s*(?:Rs\.?)?\s*([0-9.,]+)/i) ||
                       containerText.match(/Price\s*:\s*(?:Rs\.?)?\s*([0-9.,]+)/i);
    if (priceMatch) {
      reservePriceText = priceMatch[0].trim();
    }

    // Extract Status from container elements, badges, text patterns, or active tab header
    let rawStatus = "";

    // 1. Direct status badge/tag inside container
    const statusEl = container.querySelector(
      ".status, .badge, [class*='status'], [class*='badge'], .tag, .label, .auction-status, [class*='auction-state']"
    );
    if (statusEl) {
      rawStatus = (statusEl as HTMLElement).innerText?.trim() || "";
    }

    // 2. Pattern matching in container text
    if (!rawStatus) {
      const statusMatch =
        containerText.match(/Status\s*:\s*([^\n|]+)/i) ||
        containerText.match(/Auction\s*Status\s*:\s*([^\n|]+)/i) ||
        containerText.match(/State\s*:\s*([^\n|]+)/i) ||
        containerText.match(/\b(Live\s*Auction|Upcoming\s*Auction|Closed\s*Auction|Auction\s*Ended|Cancelled\s*Auction|Live|Upcoming|Closed|Cancelled|Ended)\b/i);
      if (statusMatch) {
        rawStatus = (statusMatch[1] || statusMatch[0]).trim();
      }
    }

    // 3. Active Tab / Panel Context
    if (!rawStatus) {
      const parentTabPanel = container.closest(".TabbedPanelsContent, .tab-pane, .tab-content, [role='tabpanel']");
      if (parentTabPanel) {
        const panelId = parentTabPanel.id;
        const tabBtn = document.querySelector(
          `.TabbedPanelsTabSelected, .tab.active, [aria-selected='true']${panelId ? `, a[href='#${panelId}']` : ""}`
        );
        if (tabBtn) {
          rawStatus = (tabBtn as HTMLElement).innerText?.trim() || "";
        }
      }
    }

    // 4. Global active tab on page
    if (!rawStatus) {
      const activeTab = document.querySelector(
        ".TabbedPanelsTabSelected, .nav-tabs li.active, .tab.active, [role='tab'][aria-selected='true'], .tab-selected"
      );
      if (activeTab) {
        rawStatus = (activeTab as HTMLElement).innerText?.trim() || "";
      }
    }

    items.push({
      gem_auction_id: auctionId,
      title,
      reserve_price_text: reservePriceText,
      rawStatus,
      ministry,
      department,
      organisation,
      locationText,
      startDateStr: startMatch ? startMatch[1].trim() : "",
      endDateStr: endMatch ? endMatch[1].trim() : "",
      source_url: href || `/eprocure/view-auction-notice/${auctionId}`,
      document_url: primaryDocUrl,
      document_urls: allDocUrls,
      raw_description: containerText
    });
  });
  
  return items;
}

// ─── Scraper Execution ───────────────────────────────────────────────────────

async function runScraper() {
  const { headful, maxPages, startPage } = parseCliArgs();
  
  log.info({ headful, maxPages, startPage }, "Starting GeM Forward Auction Scraper...");
  
  // Cleanup expired items first
  await cleanupExpiredAuctions().catch((err) => {
    log.error({ error: err.message }, "Cleanup error");
  });

  const browser = await puppeteer.launch({
    headless: !headful,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(DEFAULT_USER_AGENT);
    
    log.info("Navigating to GeM Forward Auction home...");
    await page.goto("https://forwardauction.gem.gov.in/eprocure/home", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    
    await delay(3000);
    
    // Wait for the listings or the main tab container to load
    log.info("Waiting for page layouts to compile...");
    await page.waitForSelector(".TabbedPanelsTabGroup, label, a.brief", { timeout: 20000 });
    
    // Try to verify if there's a total record count visible
    const totalCountText = await page.evaluate(() => {
      const el = document.getElementById("totrecord");
      return el ? el.innerText : "unknown";
    });
    log.info({ totalCountText }, "Detected total records");
    
    let currentPage = 1;
    let scrapedCount = 0;
    let invalidCount = 0;
    let lastPageFingerprint = "";
    
    // If startPage > 1, navigate to it using page input
    if (startPage > 1) {
      log.info({ startPage }, "Jumping directly to page");
      await page.evaluate((target: number) => {
        const input = document.getElementById("gotoPage") as HTMLInputElement;
        const btn = document.getElementById("btnGoto") as HTMLButtonElement;
        if (input && btn) {
          input.value = target.toString();
          btn.click();
        }
      }, startPage);
      await delay(4000);
      currentPage = startPage;
    }
    
    while (currentPage <= maxPages) {
      log.info({ page: currentPage }, "Scraping page listings...");
      
      const rawListings = await page.evaluate(extractGeMListingsFromDOM);
      log.info({ count: rawListings.length }, "Extracted raw listings from DOM");
      
      if (rawListings.length === 0) {
        log.warn({ page: currentPage }, "No listings extracted. Ending crawl.");
        break;
      }

      // Check for stalled pagination (identical content across consecutive pages)
      const currentFingerprint = computeListingsFingerprint(
        rawListings.map((r) => r.gem_auction_id)
      );
      if (currentPage > startPage && isPaginationStalled(lastPageFingerprint, currentFingerprint)) {
        log.warn(
          { page: currentPage, fingerprint: currentFingerprint.substring(0, 16) },
          "Detected identical page content after pagination click. Pagination has stalled. Stopping crawl."
        );
        break;
      }
      lastPageFingerprint = currentFingerprint;
      
      // Parse, classify, and format listings for Supabase
      const finalListings: GeMListing[] = rawListings.map((item) => {
        const loc = parseLocation(item.locationText);
        const parsedStartDate = parseGeMDate(item.startDateStr);
        const parsedEndDate = parseGeMDate(item.endDateStr);
        
        const startDate = parsedStartDate;
        const endDate = parsedEndDate;
        const start_date_unparsed = !parsedStartDate;
        const end_date_unparsed = !parsedEndDate;
        const location_unparsed = loc.location_unparsed || !loc.location;
        
        const category_name = classifyGeMListing(item.title);
        const priceRange = parseIndianPriceRange(item.reserve_price_text);
        const reserve_price_value = priceRange.value;
        const reserve_price_value_min = priceRange.min;
        const reserve_price_value_max = priceRange.max;

        const normalizedStatus = normalizeGeMAuctionStatus(item.rawStatus);
        if (!normalizedStatus) {
          log.warn(
            { auctionId: item.gem_auction_id, rawStatus: item.rawStatus },
            "No reliable auction status signal found in DOM. Leaving auction_status as null."
          );
        }
        
        // Format absolute URLs
        const absoluteSourceUrl = item.source_url.startsWith("http")
          ? item.source_url
          : `https://forwardauction.gem.gov.in${item.source_url.startsWith('/') ? '' : '/'}${item.source_url}`;
          
        const absoluteDocUrl = item.document_url 
          ? (item.document_url.startsWith("http") ? item.document_url : `https://forwardauction.gem.gov.in${item.document_url.startsWith('/') ? '' : '/'}${item.document_url}`)
          : `https://forwardauction.gem.gov.in/eprocure/eauction-download-document/${encodeURIComponent(item.gem_auction_id)}`;

        const absoluteDocUrls = Array.isArray(item.document_urls) && item.document_urls.length > 0
          ? item.document_urls.map((u: string) => u.startsWith("http") ? u : `https://forwardauction.gem.gov.in${u.startsWith('/') ? '' : '/'}${u}`)
          : [absoluteDocUrl];
          
        return {
          gem_auction_id: item.gem_auction_id,
          title: item.title,
          reserve_price_text: item.reserve_price_text || undefined,
          reserve_price_value,
          reserve_price_value_min,
          reserve_price_value_max,
          ministry: item.ministry || undefined,
          department: item.department || undefined,
          organisation: item.organisation || undefined,
          state: loc.state || undefined,
          city: loc.city || undefined,
          pincode: loc.pincode || undefined,
          location: loc.location,
          location_unparsed,
          auction_start_date: startDate,
          auction_end_date: endDate,
          start_date_unparsed,
          end_date_unparsed,
          auction_status: normalizedStatus || null,
          source_url: absoluteSourceUrl,
          document_url: absoluteDocUrl || undefined,
          document_urls: absoluteDocUrls.length > 0 ? absoluteDocUrls : undefined,
          category_name,
          raw_description: item.raw_description || undefined,
        };
      });

      // Validate each listing using gemListingSchema before writing to database
      const validatedListings: GeMListing[] = [];
      for (const item of finalListings) {
        const parseResult = gemListingSchema.safeParse(item);
        if (!parseResult.success) {
          invalidCount++;
          const failedFields = parseResult.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`
          );
          log.warn(
            {
              gem_auction_id: item.gem_auction_id,
              failedFields,
              issues: parseResult.error.issues,
            },
            "GeM listing validation failed. Skipping record."
          );
        } else {
          validatedListings.push(item);
        }
      }
      
      // Insert into Supabase
      if (validatedListings.length > 0) {
        log.info({ count: validatedListings.length }, "Upserting batch to Supabase...");
        
        // 1. Log category and location stats for analytics
        const today = new Date().toISOString().split("T")[0];
        
        const catStats: Record<string, number> = {};
        const locStats: Record<string, number> = {};
        
        validatedListings.forEach((item) => {
          catStats[item.category_name] = (catStats[item.category_name] || 0) + 1;
          const locKey = `${item.location}|||${item.category_name}`;
          locStats[locKey] = (locStats[locKey] || 0) + 1;
        });
        
        for (const [category, count] of Object.entries(catStats)) {
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
            await supabase
              .from("category_daily_stats")
              .insert({ date: today, category_name: category, items_added: count });
          }
        }
        
        for (const [compoundKey, count] of Object.entries(locStats)) {
          const [loc, cat] = compoundKey.split("|||");
          const { data: existingLocStat } = await supabase
            .from("location_daily_stats")
            .select("id, items_added")
            .eq("date", today)
            .eq("location", loc)
            .eq("category_name", cat)
            .maybeSingle();
            
          if (existingLocStat) {
            await supabase
              .from("location_daily_stats")
              .update({ items_added: existingLocStat.items_added + count })
              .eq("id", existingLocStat.id);
          } else {
            await supabase
              .from("location_daily_stats")
              .insert({ date: today, location: loc, category_name: cat, items_added: count });
          }
        }
        
        // 2. Perform the main table upsert
        const { error: upsertError } = await supabase
          .from("gem_auctions")
          .upsert(validatedListings, {
            onConflict: "gem_auction_id",
            ignoreDuplicates: false, // Update fields if they change
          });
          
        if (upsertError) {
          log.error({ error: upsertError.message }, "Database ingestion error");
        } else {
          // Write audit logs for successful scrape
          const auditLogs = validatedListings.map((item) => ({
            action: "gem_auction_scraped",
            entity_type: "gem_auction",
            details: {
              gem_auction_id: item.gem_auction_id,
              title: item.title,
              organisation: item.organisation || "",
            },
          }));
          const { error: auditError } = await supabase.from("audit_logs").insert(auditLogs);
          if (auditError) {
            log.error({ error: auditError.message }, "Failed to write scrape audit logs");
          }
          
          scrapedCount += validatedListings.length;
          log.info({ count: validatedListings.length }, "Ingested batch successfully");
        }
      }
      
      // Check if we hit pagination end
      const hasNextPage = await page.evaluate(() => {
        const btnNext = document.getElementById("btnNext") as HTMLButtonElement;
        // Check if disabled or not clickable
        if (!btnNext || btnNext.disabled || btnNext.classList.contains("disabled")) {
          return false;
        }
        return true;
      });
      
      if (!hasNextPage || currentPage >= maxPages) {
        log.info({ currentPage }, "Reached pagination limit or last page");
        break;
      }
      
      log.info("Clicking Next page...");
      await page.evaluate(() => {
        const btnNext = document.getElementById("btnNext") as HTMLButtonElement;
        if (btnNext) btnNext.click();
      });
      
      currentPage++;
      await delay(4000); // Friendly crawling delay
    }
    
    log.info(
      { totalScraped: scrapedCount, totalInvalid: invalidCount },
      "GeM scraper task completed successfully"
    );
    
  } catch (err: any) {
    log.error({ error: err.message }, "Scraper encountered a critical exception");
  } finally {
    await browser.close().catch(() => {});
  }
}

runScraper();
