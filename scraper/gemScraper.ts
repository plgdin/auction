/**
 * GeM Portal Forward Auction Scraper
 *
 * Scrapes active government asset auctions from the GeM Portal (gem.gov.in).
 * Full fidelity pipeline: captures 100% of available portal intelligence, schedules,
 * EMD conditions, rules, documents, and contact data.
 *
 * Uses Puppeteer with stealth plugin. Fully headless by default.
 *
 * Usage:
 *   npx tsx scraper/gemScraper.ts
 *   npx tsx scraper/gemScraper.ts --headful
 *   npx tsx scraper/gemScraper.ts --tab=all --max-pages=50
 *   npx tsx scraper/gemScraper.ts --tab=live --max-pages=5
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
  parseIndianPriceRange,
  normalizeGeMAuctionStatus,
  classifyGeMListing,
  parseGemNoticeHtml,
  type GeMListing,
} from "./parsers/gemParser.js";
import { gemListingSchema } from "./schemas/gemListingSchema.js";
import { computeListingsFingerprint, isPaginationStalled } from "./utils/common/fingerprint.js";
import {
  generateAndUploadGemNoticePdf,
  downloadAndUploadGemAttachment,
} from "./utils/gem/gemDocumentService.js";

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
  tab: string; // 'live' | 'all' | 'closed' | 'cancelled'
  includeDetails: boolean;
  downloadDocs: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let headful = false;
  let maxPages = 100; // Default limit (covers all pages up to 1000 records)
  let startPage = 1;
  let tab = "live";
  let includeDetails = true;
  let downloadDocs = true;

  for (const arg of args) {
    if (arg === "--headful") headful = true;
    if (arg.startsWith("--max-pages=")) {
      maxPages = parseInt(arg.replace("--max-pages=", ""), 10);
    }
    if (arg.startsWith("--start-page=")) {
      startPage = parseInt(arg.replace("--start-page=", ""), 10);
    }
    if (arg.startsWith("--tab=")) {
      tab = arg.replace("--tab=", "").toLowerCase().trim();
    }
    if (arg === "--no-details" || arg === "--include-details=false") {
      includeDetails = false;
    }
    if (arg === "--no-docs" || arg === "--download-docs=false") {
      downloadDocs = false;
    }
    if (arg === "--download-docs" || arg === "--download-docs=true") {
      downloadDocs = true;
    }
  }

  return { headful, maxPages, startPage, tab, includeDetails, downloadDocs };
}

// ─── Delay Utility ───────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  const jitter = Math.floor(Math.random() * ms * 0.3);
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

// ─── Schema Cache & Dynamic Column Filter ────────────────────────────────────

let cachedDbColumns: Set<string> | null = null;
const warnedMissingCols = new Set<string>();

async function getAvailableDbColumns(): Promise<Set<string>> {
  if (cachedDbColumns) return cachedDbColumns;
  try {
    const { data, error } = await supabase
      .from("gem_auctions")
      .select("*")
      .limit(1);

    if (!error && data && data.length > 0) {
      cachedDbColumns = new Set(Object.keys(data[0]));
      log.info(
        { columnCount: cachedDbColumns.size },
        "Discovered remote gem_auctions table schema columns"
      );
      return cachedDbColumns;
    }
  } catch (err: any) {
    log.warn({ error: err.message }, "Failed to auto-detect gem_auctions columns");
  }
  return new Set();
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
  const briefLinks = document.querySelectorAll("a.brief.text-wrap, a.brief");
  
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
      const dHref = (dLink as HTMLAnchorElement).getAttribute("href") || "";
      if (dHref && !allDocUrls.includes(dHref)) {
        allDocUrls.push(dHref);
      }
    });
    const primaryDocUrl = allDocUrls.find(u => u.includes("eauction-download-document")) || allDocUrls[0] || `/eprocure/eauction-download-document/${auctionId}`;

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
  const { headful, maxPages, startPage, tab, includeDetails, downloadDocs } = parseCliArgs();
  
  log.info(
    { headful, maxPages, startPage, tab, includeDetails, downloadDocs },
    "Starting GeM Forward Auction Scraper (Full Intelligence Mode)..."
  );
  
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

    // Handle tab switching if user requested a non-live tab
    const tabMap: Record<string, string> = {
      live: "6",
      closed: "3",
      cancelled: "4",
      all: "7",
    };
    const targetTabIndex = tabMap[tab] || "6";

    if (targetTabIndex !== "6") {
      log.info({ tab, targetTabIndex }, "Switching to requested GeM Portal tab...");
      await page.evaluate((tIndex: string) => {
        const tabEl = document.querySelector(
          `#auctionList .TabbedPanelsTab[tabindex="${tIndex}"] a, .TabbedPanelsTab[tabindex="${tIndex}"]`
        ) as HTMLElement;
        if (tabEl) tabEl.click();
      }, targetTabIndex);
      await delay(4000);
    }
    
    // Total record count visible on active tab
    const totalCountText = await page.evaluate(() => {
      const el = document.getElementById("totrecord");
      return el ? el.innerText : "unknown";
    });
    log.info({ totalCountText, activeTab: tab }, "Detected total records for selected tab");
    
    let currentPage = 1;
    let scrapedCount = 0;
    let invalidCount = 0;
    let lastPageFingerprint = "";
    
    // If startPage > 1, navigate to it using page input
    if (startPage > 1) {
      log.info({ startPage }, "Jumping directly to start page");
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

      // ─── Fetch Full Notice Details In-Session ─────────────────────────────
      let noticeHtmlMap: Record<string, string> = {};
      if (includeDetails) {
        log.info({ count: rawListings.length }, "Fetching detailed notice documents in-session...");
        noticeHtmlMap = await page.evaluate(async (items) => {
          const map: Record<string, string> = {};
          for (const item of items) {
            if (!item.source_url) continue;
            try {
              const res = await fetch(item.source_url);
              if (res.ok) {
                map[item.gem_auction_id] = await res.text();
              }
            } catch (e) {
              // Ignore single item fetch failure
            }
          }
          return map;
        }, rawListings);
      }
      
      // ─── Generate & Store Official Documents in Supabase Storage ──────────
      const storedDocUrls: Record<string, string> = {};
      const storedCorrigendumUrls: Record<string, string[]> = {};
      if (downloadDocs && includeDetails) {
        log.info({ count: rawListings.length }, "Generating official PDFs and uploading to Supabase Storage...");
        for (const item of rawListings) {
          const rawHtml = noticeHtmlMap[item.gem_auction_id];
          if (!rawHtml) continue;
          try {
            const docResult = await generateAndUploadGemNoticePdf(
              browser,
              item.gem_auction_id,
              rawHtml,
              item.title
            );
            storedDocUrls[item.gem_auction_id] = docResult.publicUrl;

            // Extract and upload any corrigendums/attachments
            const notice = parseGemNoticeHtml(rawHtml);
            if (notice.corrigendum_urls && notice.corrigendum_urls.length > 0) {
              const corrs: string[] = [];
              for (let i = 0; i < notice.corrigendum_urls.length; i++) {
                const corrUpload = await downloadAndUploadGemAttachment(
                  browser,
                  item.gem_auction_id,
                  notice.corrigendum_urls[i],
                  i + 1
                );
                if (corrUpload) corrs.push(corrUpload);
              }
              if (corrs.length > 0) {
                storedCorrigendumUrls[item.gem_auction_id] = corrs;
              }
            }
          } catch (docErr: any) {
            log.warn(
              { auctionId: item.gem_auction_id, error: docErr.message },
              "Notice PDF generation skipped on error"
            );
          }
        }
      }

      // ─── Parse, enrich, and format listings for Supabase ─────────────────
      const finalListings: GeMListing[] = rawListings.map((item) => {
        const rawHtml = noticeHtmlMap[item.gem_auction_id];
        const notice = rawHtml ? parseGemNoticeHtml(rawHtml) : {};

        const loc = parseLocation(item.locationText);

        // Dates: prefer precise notice dates over card snippets
        const parsedStartDate = notice.auction_start_date || parseGeMDate(item.startDateStr);
        const parsedEndDate = notice.auction_end_date || parseGeMDate(item.endDateStr);
        
        const startDate = parsedStartDate;
        const endDate = parsedEndDate;
        const start_date_unparsed = !parsedStartDate;
        const end_date_unparsed = !parsedEndDate;

        // Location: prefer exact table extracted location
        const city = notice.city || loc.city || undefined;
        const district = notice.district || undefined;
        const state = notice.state || loc.state || undefined;
        const pincode = notice.pin_code || loc.pincode || undefined;

        const locationParts = [city, district, state].filter(Boolean);
        const location = locationParts.length > 0
          ? locationParts.join(", ")
          : (loc.location || "India");

        const location_unparsed = notice.pin_code
          ? false
          : (loc.location_unparsed || !loc.location);
        
        // Category: prefer official GeM notice category
        const category_name = notice.category_name || classifyGeMListing(item.title);

        // Price range
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
        
        // Format absolute URLs (prefer persistent Supabase Storage URLs)
        const absoluteSourceUrl = item.source_url.startsWith("http")
          ? item.source_url
          : `https://forwardauction.gem.gov.in${item.source_url.startsWith('/') ? '' : '/'}${item.source_url}`;
          
        const absoluteDocUrl = storedDocUrls[item.gem_auction_id] || (item.document_url 
          ? (item.document_url.startsWith("http") ? item.document_url : `https://forwardauction.gem.gov.in${item.document_url.startsWith('/') ? '' : '/'}${item.document_url}`)
          : `https://forwardauction.gem.gov.in/eprocure/eauction-download-document/${encodeURIComponent(item.gem_auction_id)}`);

        const absoluteDocUrls = storedDocUrls[item.gem_auction_id]
          ? [storedDocUrls[item.gem_auction_id]]
          : (Array.isArray(item.document_urls) && item.document_urls.length > 0
            ? item.document_urls.map((u: string) => u.startsWith("http") ? u : `https://forwardauction.gem.gov.in${u.startsWith('/') ? '' : '/'}${u}`)
            : [absoluteDocUrl]);

        const absoluteCorrigendumUrls = storedCorrigendumUrls[item.gem_auction_id] || (Array.isArray(notice.corrigendum_urls) && notice.corrigendum_urls.length > 0
          ? notice.corrigendum_urls.map((u: string) => u.startsWith("http") ? u : `https://forwardauction.gem.gov.in${u.startsWith('/') ? '' : '/'}${u}`)
          : undefined);
          
        return {
          gem_auction_id: item.gem_auction_id,
          title: item.title,
          reserve_price_text: item.reserve_price_text || undefined,
          reserve_price_value,
          reserve_price_value_min,
          reserve_price_value_max,
          ministry: notice.ministry || item.ministry || undefined,
          department: notice.department || item.department || undefined,
          organisation: notice.organisation || item.organisation || undefined,
          state,
          city,
          district,
          pincode,
          location,
          location_unparsed,
          auction_start_date: startDate,
          auction_end_date: endDate,
          start_date_unparsed,
          end_date_unparsed,
          auction_status: normalizedStatus || null,
          source_url: absoluteSourceUrl,
          document_url: absoluteDocUrl || undefined,
          document_urls: absoluteDocUrls.length > 0 ? absoluteDocUrls : undefined,
          corrigendum_urls: absoluteCorrigendumUrls,
          category_name,
          raw_description: item.raw_description || undefined,
          detailed_description: notice.detailed_description || undefined,
          reference_no: notice.reference_no || undefined,
          seller_name: notice.seller_name || undefined,
          contact_phone: notice.contact_phone || undefined,
          contact_email: notice.contact_email || undefined,
          emd_amount: notice.emd_amount,
          emd_mode: notice.emd_mode || undefined,
          emd_start_date: notice.emd_start_date || undefined,
          emd_end_date: notice.emd_end_date || undefined,
          bidding_access: notice.bidding_access || undefined,
          item_wise_time: notice.item_wise_time || undefined,
          auto_extension: notice.auto_extension || undefined,
          bidding_template: notice.bidding_template || undefined,
          items_schedule: notice.items_schedule,
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
        
        // 2. Filter payload against currently available columns in database schema
        const availableCols = await getAvailableDbColumns();
        const payloadToInsert = validatedListings.map((listing) => {
          if (availableCols.size === 0) return listing;
          const safeRecord: Record<string, any> = {};
          for (const [key, value] of Object.entries(listing)) {
            if (availableCols.has(key)) {
              safeRecord[key] = value;
            } else if (!warnedMissingCols.has(key)) {
              warnedMissingCols.add(key);
              log.warn(
                { column: key },
                `Column '${key}' does not yet exist in remote gem_auctions table. Run migration 20260916180000_gem_auctions_full_details.sql to enable persistence for this field.`
              );
            }
          }
          return safeRecord;
        });

        // 3. Perform the main table upsert
        const { error: upsertError } = await supabase
          .from("gem_auctions")
          .upsert(payloadToInsert, {
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
              has_schedule: !!(item.items_schedule && item.items_schedule.length > 0),
              emd_amount: item.emd_amount,
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
      { totalScraped: scrapedCount, totalInvalid: invalidCount, tab },
      "GeM scraper task completed successfully"
    );
    
  } catch (err: any) {
    log.error({ error: err.message }, "Scraper encountered a critical exception");
  } finally {
    await browser.close().catch(() => {});
  }
}

runScraper();
