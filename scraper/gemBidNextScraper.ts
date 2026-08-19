/**
 * GeM Portal BidNext Procurement Scraper
 *
 * Scrapes ongoing bids, services, and reverse auctions from GeM BidNext
 * (https://bidnext.gem.gov.in/bidnext/home).
 *
 * Usage:
 *   npx tsx scraper/gemBidNextScraper.ts
 *   npx tsx scraper/gemBidNextScraper.ts --headful
 *   npx tsx scraper/gemBidNextScraper.ts --max-pages=30
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
import { parseGeMBidDate, classifyGeMBid } from "./parsers/gemBidParser.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

puppeteer.use(StealthPlugin());

const log = logger.child({ module: "gemBidNextScraper" });

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
  let maxPages = 50;
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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GemBidNextItem {
  bid_number: string;
  ra_number?: string | null;
  items: string;
  quantity?: string | null;
  department_name?: string | null;
  start_date: string;
  end_date: string;
  status: string;
  document_url?: string | null;
  category_name: string;
  raw_description?: string | null;
}

// ─── Database Operations ─────────────────────────────────────────────────────

async function upsertBidNextItems(items: GemBidNextItem[]): Promise<{ upserted: number; failed: number }> {
  if (items.length === 0) return { upserted: 0, failed: 0 };

  let upserted = 0;
  let failed = 0;

  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const records = chunk.map((n) => ({
      bid_number: n.bid_number,
      ra_number: n.ra_number || null,
      items: n.items,
      quantity: n.quantity || null,
      department_name: n.department_name || null,
      start_date: n.start_date,
      end_date: n.end_date,
      status: n.status,
      document_url: n.document_url || null,
      category_name: n.category_name,
      raw_description: n.raw_description || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("gem_bids")
      .upsert(records, { onConflict: "bid_number" });

    if (error) {
      log.error({ error: error.message, chunkIndex: i }, "Failed to upsert GeM BidNext chunk");
      failed += chunk.length;
    } else {
      upserted += chunk.length;
    }
  }

  return { upserted, failed };
}

async function recordAuditLog(action: string, details: Record<string, any>) {
  try {
    await supabase.from("audit_logs").insert([
      {
        action,
        entity: "gem_bids",
        details,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err: any) {
    log.warn({ err: err?.message }, "Failed to insert audit log record");
  }
}

// ─── Main Scraper Logic ──────────────────────────────────────────────────────

export async function runGemBidNextScraper(cliArgs?: CliArgs) {
  const args = cliArgs || parseCliArgs();

  log.info(
    { headful: args.headful, maxPages: args.maxPages, startPage: args.startPage },
    "Starting GeM BidNext Scraper..."
  );

  const browser = await puppeteer.launch({
    headless: !args.headful,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920,1080",
    ],
  });

  const startTime = Date.now();
  let totalScraped = 0;
  let totalUpserted = 0;
  let totalFailed = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(DEFAULT_USER_AGENT);

    for (let pageNum = args.startPage; pageNum < args.startPage + args.maxPages; pageNum++) {
      const pageUrl = `https://bidnext.gem.gov.in/bidnext/home?page=${pageNum}`;
      log.info({ pageNum, pageUrl }, `Fetching GeM BidNext Page ${pageNum}...`);

      let loaded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 35000 });
          loaded = true;
          break;
        } catch (err: any) {
          log.warn({ attempt, err: err?.message }, `Attempt ${attempt} failed for page ${pageNum}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!loaded) {
        log.error({ pageNum }, `Could not load page ${pageNum}, skipping`);
        continue;
      }

      await new Promise((r) => setTimeout(r, 2500));

      const rawItems = await page.evaluate(() => {
        const results: Array<{
          bidNumber: string;
          raNumber?: string;
          items: string;
          quantity: string;
          department: string;
          startDate: string;
          endDate: string;
          docUrl?: string;
        }> = [];

        // DOM extraction for cards / table rows
        const cards = Array.from(document.querySelectorAll(".card, .bid-card, .listing-card, tr.bid-row"));
        if (cards.length > 0) {
          cards.forEach((card) => {
            const fullText = card.textContent || "";
            const bidMatch = fullText.match(/GEM\/\d{4}\/[A-Z0-9\/]+/i);
            if (!bidMatch) return;

            const bidNumber = bidMatch[0].trim();
            const raMatch = fullText.match(/GEM\/\d{4}\/R\/[A-Z0-9\/]+/i);
            const raNumber = raMatch ? raMatch[0].trim() : undefined;

            const linkEl = card.querySelector('a[href*="showbidDocument"], a[href*="download"], a[href*="bid-document"]');
            const docUrl = linkEl?.getAttribute("href") || undefined;

            results.push({
              bidNumber,
              raNumber,
              items: card.querySelector(".item-title, .bid-title, h4, h5, .title")?.textContent?.trim() || "Procurement Item",
              quantity: card.querySelector(".quantity, .qty")?.textContent?.replace(/Quantity:?/i, "")?.trim() || "1",
              department: card.querySelector(".department, .dept, .org")?.textContent?.trim() || "Government of India",
              startDate: "",
              endDate: "",
              docUrl,
            });
          });
        }

        // Text parsing fallback
        if (results.length === 0) {
          const bodyText = document.body.innerText || "";
          const blocks = bodyText.split(/Bid\s*(?:Number|No\.?):\s*/i).slice(1);

          for (const block of blocks) {
            const lines = block
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            if (lines.length === 0) continue;

            const bidNumber = lines[0].split(/\s+/)[0].trim();
            if (!bidNumber.startsWith("GEM/")) continue;

            const itemsMatch = block.match(/Item\(s\)\s*:\s*([^:\n]+)/i);
            const qtyMatch = block.match(/Quantity\s*:\s*([\d\w\s]+)/i);
            const deptMatch = block.match(/Department\s*:\s*([^:\n]+)/i);
            const startMatch = block.match(/Start\s*Date\s*:\s*([\d-]+\s+[\d:]+\s*(?:AM|PM)?)/i);
            const endMatch = block.match(/End\s*Date\s*:\s*([\d-]+\s+[\d:]+\s*(?:AM|PM)?)/i);

            results.push({
              bidNumber,
              items: itemsMatch ? itemsMatch[1].trim() : lines[1] || "GeM Procurement Tender",
              quantity: qtyMatch ? qtyMatch[1].trim() : "1",
              department: deptMatch ? deptMatch[1].trim() : "Government of India",
              startDate: startMatch ? startMatch[1].trim() : "",
              endDate: endMatch ? endMatch[1].trim() : "",
            });
          }
        }

        return results;
      });

      if (rawItems.length === 0) {
        log.info({ pageNum }, "No more BidNext items found on this page. Ending crawl.");
        break;
      }

      log.info({ pageNum, count: rawItems.length }, `Extracted ${rawItems.length} items on page ${pageNum}`);

      const processedItems: GemBidNextItem[] = [];
      const now = new Date();

      for (const item of rawItems) {
        const startIso = parseGeMBidDate(item.startDate) || new Date().toISOString();
        const endIso =
          parseGeMBidDate(item.endDate) ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const isLive = now <= new Date(endIso);
        const classifiedCategory = classifyGeMBid(item.items);

        processedItems.push({
          bid_number: item.bidNumber,
          ra_number: item.raNumber,
          items: item.items,
          quantity: item.quantity,
          department_name: item.department,
          start_date: startIso,
          end_date: endIso,
          status: isLive ? "live" : "ended",
          document_url: item.docUrl?.startsWith("http")
            ? item.docUrl
            : item.docUrl
            ? `https://bidnext.gem.gov.in${item.docUrl.startsWith("/") ? "" : "/"}${item.docUrl}`
            : `https://bidnext.gem.gov.in/bidnext/home`,
          category_name: classifiedCategory || "GeM | BidNext",
          raw_description: JSON.stringify({
            bid_number: item.bidNumber,
            ra_number: item.raNumber,
            items: item.items,
            quantity: item.quantity,
            department: item.department,
            source: "bidnext.gem.gov.in",
          }),
        });
      }

      const { upserted, failed } = await upsertBidNextItems(processedItems);
      totalScraped += processedItems.length;
      totalUpserted += upserted;
      totalFailed += failed;

      log.info({ pageNum, pageUpserted: upserted, totalUpserted }, `Page ${pageNum} upsert complete.`);

      const delay = 1500 + Math.floor(Math.random() * 1000);
      await new Promise((r) => setTimeout(r, delay));
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info(
      { totalScraped, totalUpserted, totalFailed, durationSeconds },
      "GeM BidNext Scraper finished successfully."
    );

    await recordAuditLog("gem_bidnext_scraped", {
      total_scraped: totalScraped,
      total_upserted: totalUpserted,
      total_failed: totalFailed,
      duration_seconds: parseFloat(durationSeconds),
      completed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    log.error({ err: err?.message, stack: err?.stack }, "GeM BidNext Scraper encountered an error");
    await recordAuditLog("gem_bidnext_failed", {
      error: err?.message,
      failed_at: new Date().toISOString(),
    });
  } finally {
    await browser.close();
  }

  return { totalScraped, totalUpserted, totalFailed };
}

// ─── Direct Script Execution ─────────────────────────────────────────────────

if (process.argv[1]?.endsWith("gemBidNextScraper.ts") || process.argv[1]?.endsWith("gemBidNextScraper.js")) {
  runGemBidNextScraper()
    .then((stats) => {
      console.log("\n=== GeM BidNext Scraper Summary ===");
      console.log(`Total Scraped:  ${stats?.totalScraped || 0}`);
      console.log(`Total Upserted: ${stats?.totalUpserted || 0}`);
      console.log(`Total Failed:   ${stats?.totalFailed || 0}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Scraper execution failed:", err);
      process.exit(1);
    });
}
