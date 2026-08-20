/**
 * GeM Portal Procurement Bids / Tenders Scraper
 *
 * Scrapes ongoing bids and reverse auctions from GeM BidPlus (bidplus.gem.gov.in/bidlists).
 * Uses Puppeteer with stealth plugin. Headless by default.
 *
 * Usage:
 *   npx tsx scraper/gemBidScraper.ts
 *   npx tsx scraper/gemBidScraper.ts --headful
 *   npx tsx scraper/gemBidScraper.ts --max-pages=50
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
  parseGeMBidDate,
  classifyGeMBid,
  type GeMBid,
} from "./parsers/gemBidParser.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

puppeteer.use(StealthPlugin());

const log = logger.child({ module: "gemBidScraper" });

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
  let maxPages = 150; // Default limit (covers 1500 bids)
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

// ─── Expired Bids Cleanup ────────────────────────────────────────────────────

async function cleanupExpiredBids(): Promise<void> {
  log.info("Checking for expired GeM bids...");

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { data: expired, error: fetchError } = await supabase
    .from("gem_bids")
    .select("id, bid_number, end_date")
    .lt("end_date", oneDayAgo.toISOString());

  if (fetchError) {
    log.error({ error: fetchError.message }, "Failed to fetch expired GeM bids");
    return;
  }

  if (!expired || expired.length === 0) {
    log.info("No expired GeM bids found to purge.");
    return;
  }

  log.info({ count: expired.length }, `Purging expired GeM bids...`);

  // Write audit entries
  const auditLogs = expired.map(item => ({
    action: "gem_bid_deleted",
    entity_type: "gem_bid",
    details: { bid_number: item.bid_number, expired_at: item.end_date }
  }));

  const { error: logError } = await supabase.from("audit_logs").insert(auditLogs);
  if (logError) {
    log.error({ error: logError.message }, "Failed to write expired bids audit logs");
  }

  const ids = expired.map(item => item.id);
  const { error: deleteError } = await supabase.from("gem_bids").delete().in("id", ids);

  if (deleteError) {
    log.error({ error: deleteError.message }, "Failed to delete expired bids records");
  } else {
    log.info({ count: expired.length }, "Expired GeM bids purged successfully.");
  }
}

// ─── DOM Listing Extractor ───────────────────────────────────────────────────

function extractGeMBidsFromDOM(): any[] {
  const items: any[] = [];
  const cards = document.querySelectorAll(".card");
  
  cards.forEach((card) => {
    // Validate that this is a bid card element
    const bidNoEl = card.querySelector(".bid_no a.bid_no_hover");
    if (!bidNoEl) return;
    
    const bidNumber = bidNoEl.textContent?.trim() || "";
    if (!bidNumber.startsWith("GEM/")) return; // Only process valid GeM Bid Nos
    
    const bidHref = bidNoEl.getAttribute("href") || "";
    
    // Find RA Number if present
    let raNumber = "";
    let raHref = "";
    const raEl = Array.from(card.querySelectorAll(".bid_no a.bid_no_hover")).find(
      (a) => a.getAttribute("href")?.includes("showradocument") || a.textContent?.includes("/R/")
    );
    if (raEl) {
      raNumber = raEl.textContent?.trim() || "";
      raHref = raEl.getAttribute("href") || "";
    }
    
    const cardText = (card as HTMLElement).innerText || "";
    
    // Extract Items
    let itemsText = "";
    const itemsMatch = cardText.match(/Items\s*:\s*([^\n]+)/i);
    if (itemsMatch) {
      itemsText = itemsMatch[1].trim();
    }
    
    // Extract Quantity
    let quantity = "";
    const qtyMatch = cardText.match(/Quantity\s*:\s*([^\n]+)/i);
    if (qtyMatch) {
      quantity = qtyMatch[1].trim();
    }
    
    // Extract Department
    let department = "";
    const deptMatch = cardText.match(/Department\s*Name\s*(?:And\s*Address)?\s*:\s*([^\n]+)/i) || 
                      cardText.match(/Department\s*:\s*([^\n]+)/i);
    if (deptMatch) {
      department = deptMatch[1].trim();
      const index = department.toLowerCase().indexOf("start date");
      if (index !== -1) {
        department = department.substring(0, index).trim();
      }
    }
    
    // Extract Dates
    const startMatch = cardText.match(/Start\s*Date\s*:\s*([\d\-/: ]+\s*(?:AM|PM))/i);
    const endMatch = cardText.match(/End\s*Date\s*:\s*([\d\-/: ]+\s*(?:AM|PM))/i);

    // Extract all Corrigendum document links
    const corrigendumUrls: string[] = [];
    const corrLinks = card.querySelectorAll("a[href*='showcorrigendumpdf'], a[href*='showcorrigendum'], a[href*='corrigendumpdf'], [class*='corrigendum'] a");
    corrLinks.forEach((cLink) => {
      const href = (cLink as HTMLAnchorElement).getAttribute("href") || "";
      if (href && !corrigendumUrls.includes(href)) {
        corrigendumUrls.push(href);
      }
    });

    // Extract all attached document links (Bid Doc, RA Doc, Buyer ATC, Tech Specs)
    const allDocUrls: string[] = [];
    if (bidHref) allDocUrls.push(bidHref);
    if (raHref && !allDocUrls.includes(raHref)) allDocUrls.push(raHref);

    const docLinks = card.querySelectorAll("a[href*='showbidDocument'], a[href*='showradocument'], a[href*='showatcdocument'], a[href*='buyerATC'], a[href*='.pdf']");
    docLinks.forEach((dLink) => {
      const href = (dLink as HTMLAnchorElement).getAttribute("href") || "";
      if (href && !allDocUrls.includes(href)) {
        allDocUrls.push(href);
      }
    });

    items.push({
      bid_number: bidNumber,
      ra_number: raNumber || null,
      items: itemsText,
      quantity: quantity || null,
      department_name: department || null,
      startDateStr: startMatch ? startMatch[1].trim() : "",
      endDateStr: endMatch ? endMatch[1].trim() : "",
      document_url: bidHref || `/showbidDocument/${encodeURIComponent(bidNumber)}`,
      ra_document_url: raHref || null,
      document_urls: allDocUrls,
      corrigendum_urls: corrigendumUrls,
      raw_description: cardText,
    });
  });
  
  return items;
}

// ─── Scraper Execution ───────────────────────────────────────────────────────

async function runScraper() {
  const { headful, maxPages, startPage } = parseCliArgs();
  
  log.info({ headful, maxPages, startPage }, "Starting GeM BidPlus Scraper...");
  
  // Cleanup expired bids first
  await cleanupExpiredBids().catch((err) => {
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
    
    log.info("Navigating to GeM BidPlus all-bids listings...");
    await page.goto("https://bidplus.gem.gov.in/all-bids", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    
    await delay(3000);
    
    // Wait for the listings or cards to load
    log.info("Waiting for page elements to load...");
    await page.waitForSelector(".card, .bid_no, a.page-link.next", { timeout: 20000 });
    
    let currentPage = 1;
    let scrapedCount = 0;
    
    // If startPage > 1, navigate to it
    if (startPage > 1) {
      log.info({ startPage }, "Jumping directly to page...");
      await page.evaluate((target: number) => {
        // Go page input and click
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
      
      const rawListings = await page.evaluate(extractGeMBidsFromDOM);
      log.info({ count: rawListings.length }, "Extracted raw bids from DOM");
      
      if (rawListings.length === 0) {
        log.warn({ page: currentPage }, "No listings extracted. Ending crawl.");
        break;
      }
      
      // Parse, classify, and format listings for Supabase
      const finalListings: GeMBid[] = rawListings.map((item) => {
        const startDate = parseGeMBidDate(item.startDateStr) || new Date().toISOString();
        const endDate = parseGeMBidDate(item.endDateStr) || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        
        const category_name = classifyGeMBid(item.items);
        
        // Format absolute URLs
        const absoluteSourceUrl = item.document_url
          ? (item.document_url.startsWith("http") ? item.document_url : `https://bidplus.gem.gov.in/${item.document_url.replace(/^\/+/, '')}`)
          : `https://bidplus.gem.gov.in/showbidDocument/${encodeURIComponent(item.bid_number)}`;
          
        const absoluteRaUrl = item.ra_document_url
          ? (item.ra_document_url.startsWith("http") ? item.ra_document_url : `https://bidplus.gem.gov.in/${item.ra_document_url.replace(/^\/+/, '')}`)
          : null;

        const absoluteCorrigendumUrls = Array.isArray(item.corrigendum_urls)
          ? item.corrigendum_urls.map((u: string) => u.startsWith("http") ? u : `https://bidplus.gem.gov.in/${u.replace(/^\/+/, '')}`)
          : [];

        const absoluteDocUrls = Array.isArray(item.document_urls) && item.document_urls.length > 0
          ? item.document_urls.map((u: string) => u.startsWith("http") ? u : `https://bidplus.gem.gov.in/${u.replace(/^\/+/, '')}`)
          : [absoluteSourceUrl];
          
        return {
          bid_number: item.bid_number,
          ra_number: item.ra_number || undefined,
          items: item.items,
          quantity: item.quantity || undefined,
          department_name: item.department_name || undefined,
          start_date: startDate,
          end_date: endDate,
          status: "live",
          document_url: absoluteSourceUrl || undefined,
          ra_document_url: absoluteRaUrl || undefined,
          document_urls: absoluteDocUrls.length > 0 ? absoluteDocUrls : undefined,
          corrigendum_urls: absoluteCorrigendumUrls.length > 0 ? absoluteCorrigendumUrls : undefined,
          category_name,
          raw_description: item.raw_description || undefined,
        };
      });
      
      // Insert into Supabase
      if (finalListings.length > 0) {
        log.info({ count: finalListings.length }, "Upserting batch to Supabase...");
        
        const { error: upsertError } = await supabase
          .from("gem_bids")
          .upsert(finalListings, {
            onConflict: "bid_number",
            ignoreDuplicates: false,
          });
          
        if (upsertError) {
          log.error({ error: upsertError.message }, "Database ingestion error");
        } else {
          // Write audit logs for successful scrape
          const auditLogs = finalListings.map((item) => ({
            action: "gem_bid_scraped",
            entity_type: "gem_bid",
            details: {
              bid_number: item.bid_number,
              items: item.items,
              department_name: item.department_name || "",
            },
          }));
          const { error: auditError } = await supabase.from("audit_logs").insert(auditLogs);
          if (auditError) {
            log.error({ error: auditError.message }, "Failed to write scrape audit logs");
          }
          
          scrapedCount += finalListings.length;
          log.info({ count: finalListings.length }, "Ingested batch successfully");
        }
      }
      
      // Check if we hit pagination end
      const hasNextPage = await page.evaluate(() => {
        const btnNext = document.querySelector("a.page-link.next") as HTMLAnchorElement;
        if (!btnNext || btnNext.classList.contains("disabled") || btnNext.getAttribute("disabled")) {
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
        const btnNext = document.querySelector("a.page-link.next") as HTMLAnchorElement;
        if (btnNext) btnNext.click();
      });
      
      currentPage++;
      await delay(4000); // Friendly crawling delay
    }
    
    log.info({ totalScraped: scrapedCount }, "GeM bids scraper task completed successfully");
    
  } catch (err: any) {
    log.error({ error: err.message }, "Scraper encountered a critical exception");
  } finally {
    await browser.close().catch(() => {});
  }
}

runScraper();
