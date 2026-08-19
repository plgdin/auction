/**
 * GeM Portal Product PBP (Push Button Procurement) Notice Scraper
 *
 * Scrapes ongoing and published Push Button Procurement notices from
 * bestprice.gem.gov.in (?tab=Product PBP Notice).
 *
 * Usage:
 *   npx tsx scraper/gemPbpScraper.ts
 *   npx tsx scraper/gemPbpScraper.ts --headful
 *   npx tsx scraper/gemPbpScraper.ts --max-pages=20
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
import { parseGeMBidDate } from "./parsers/gemBidParser.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

puppeteer.use(StealthPlugin());

const log = logger.child({ module: "gemPbpScraper" });

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
  let maxPages = 50; // Default: scrape up to 50 pages (1000 notices)
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

export interface GemPbpNotice {
  bid_number: string; // e.g. "GEM/2026/PBP/4403"
  items: string;
  quantity?: string | null;
  department_name?: string | null;
  ministry?: string | null;
  organization?: string | null;
  start_date: string;
  end_date: string;
  status: string;
  document_url?: string | null;
  category_name: string;
  raw_description?: string | null;
}

// ─── Database Operations ─────────────────────────────────────────────────────

async function upsertPbpNotices(notices: GemPbpNotice[]): Promise<{ upserted: number; failed: number }> {
  if (notices.length === 0) return { upserted: 0, failed: 0 };

  let upserted = 0;
  let failed = 0;

  // Batch in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < notices.length; i += CHUNK_SIZE) {
    const chunk = notices.slice(i, i + CHUNK_SIZE);
    const records = chunk.map((n) => ({
      bid_number: n.bid_number,
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
      log.error({ error: error.message, chunkIndex: i }, "Failed to upsert GeM PBP notice chunk");
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

export async function runGemPbpScraper(cliArgs?: CliArgs) {
  const args = cliArgs || parseCliArgs();

  log.info(
    { headful: args.headful, maxPages: args.maxPages, startPage: args.startPage },
    "Starting GeM Product PBP Notice Scraper..."
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
      const pageUrl = `https://bestprice.gem.gov.in/?page=${pageNum}&per_page=20&tab=Product%20PBP%20Notice&search=%7B"value":null%7D`;
      log.info({ pageNum, pageUrl }, `Fetching GeM PBP Page ${pageNum}...`);

      let loaded = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
          loaded = true;
          break;
        } catch (err: any) {
          log.warn({ attempt, err: err?.message }, `Attempt ${attempt} failed for page ${pageNum}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!loaded) {
        log.error({ pageNum }, `Could not load page ${pageNum}, skipping to next page`);
        continue;
      }

      // Allow DOM hydration
      await new Promise((r) => setTimeout(r, 2500));

      // Extract raw card data from DOM
      const rawCards = await page.evaluate(() => {
        const results: Array<{
          pbpNumber: string;
          items: string;
          quantity: string;
          ministry: string;
          organization: string;
          department: string;
          createDate: string;
          endDate: string;
          docUrl?: string;
        }> = [];

        // Try extracting card blocks
        // Look for cards containing "PBP Notice Number:"
        const allElements = Array.from(document.querySelectorAll("*"));
        const cardContainers = allElements.filter((el) => {
          const text = el.textContent || "";
          return (
            text.includes("PBP Notice Number:") &&
            (el.classList.contains("card") ||
              el.tagName === "DIV" ||
              el.tagName === "SECTION" ||
              el.classList.contains("border") ||
              el.classList.contains("shadow"))
          );
        });

        // Find the most granular elements that represent individual cards
        const seenPbp = new Set<string>();

        // Text parsing fallback
        const bodyText = document.body.innerText || "";
        const noticeBlocks = bodyText.split(/PBP Notice Number:\s*/i).slice(1);

        for (const block of noticeBlocks) {
          const lines = block
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          if (lines.length === 0) continue;

          const pbpNumber = lines[0].split(/\s+/)[0].trim();
          if (!pbpNumber || seenPbp.has(pbpNumber)) continue;
          seenPbp.add(pbpNumber);

          let items = "";
          let quantity = "";
          let ministry = "";
          let organization = "";
          let department = "";
          let createDate = "";
          let endDate = "";

          const fullText = block;

          // Match Item(s)
          const itemsMatch = fullText.match(/Item\(s\)\s*:\s*([^:\n]+(?:\n(?![A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*:)[^\n]+)*)/i);
          if (itemsMatch) items = itemsMatch[1].replace(/\s+/g, " ").trim();

          // Match Quantity Required
          const qtyMatch = fullText.match(/Quantity\s*(?:Required)?\s*:\s*(\d+[\w\s]*)/i);
          if (qtyMatch) quantity = qtyMatch[1].trim();

          // Match Ministry
          const minMatch = fullText.match(/Ministry\s*:\s*([^\n]+)/i);
          if (minMatch) ministry = minMatch[1].trim();

          // Match Organization
          const orgMatch = fullText.match(/Organization\s*:\s*([^\n]+)/i);
          if (orgMatch) organization = orgMatch[1].trim();

          // Match Department
          const deptMatch = fullText.match(/Department(?:\s*Name\s*(?:And|&)\s*Address)?\s*:\s*([^:\n]+(?:\n(?![A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*:)[^\n]+)*)/i);
          if (deptMatch) department = deptMatch[1].replace(/\s+/g, " ").trim();

          // Match Create Date
          const cDateMatch = fullText.match(/Create\s*Date\s*:\s*([\d-]+\s+[\d:]+\s*(?:AM|PM)?)/i);
          if (cDateMatch) createDate = cDateMatch[1].trim();

          // Match End Date
          const eDateMatch = fullText.match(/End\s*Date\s*:\s*([\d-]+\s+[\d:]+\s*(?:AM|PM)?)/i);
          if (eDateMatch) endDate = eDateMatch[1].trim();

          results.push({
            pbpNumber: pbpNumber.startsWith("GEM/") ? pbpNumber : `GEM/PBP/${pbpNumber}`,
            items: items || "Push Button Procurement Item",
            quantity: quantity || "1",
            ministry,
            organization,
            department,
            createDate,
            endDate,
          });
        }

        return results;
      });

      if (rawCards.length === 0) {
        log.info({ pageNum }, "No more PBP notices found on this page. Finished.");
        break;
      }

      log.info({ pageNum, count: rawCards.length }, `Found ${rawCards.length} PBP notices on page ${pageNum}`);

      const processedNotices: GemPbpNotice[] = [];
      const now = new Date();

      for (const card of rawCards) {
        const startDateIso = parseGeMBidDate(card.createDate) || new Date().toISOString();
        const endDateIso =
          parseGeMBidDate(card.endDate) ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const endDateObj = new Date(endDateIso);
        const isLive = now <= endDateObj;

        const deptParts = [card.ministry, card.organization, card.department].filter(Boolean);
        const fullDepartment = deptParts.length > 0 ? deptParts.join(" • ") : "Government of India";

        processedNotices.push({
          bid_number: card.pbpNumber,
          items: card.items,
          quantity: card.quantity,
          ministry: card.ministry,
          organization: card.organization,
          department_name: fullDepartment,
          start_date: startDateIso,
          end_date: endDateIso,
          status: isLive ? "live" : "ended",
          document_url: `https://bestprice.gem.gov.in/?page=${pageNum}&tab=Product%20PBP%20Notice`,
          category_name: "GeM | Product PBP Notice",
          raw_description: JSON.stringify({
            pbp_notice_number: card.pbpNumber,
            item_details: card.items,
            quantity_required: card.quantity,
            ministry: card.ministry,
            organization: card.organization,
            department: card.department,
            create_date: card.createDate,
            end_date: card.endDate,
            portal_source: "bestprice.gem.gov.in",
          }),
        });
      }

      const { upserted, failed } = await upsertPbpNotices(processedNotices);
      totalScraped += processedNotices.length;
      totalUpserted += upserted;
      totalFailed += failed;

      log.info(
        { pageNum, pageUpserted: upserted, totalUpserted },
        `Page ${pageNum} complete: ${upserted} upserted.`
      );

      // Random respectful delay between pages
      const delay = 1500 + Math.floor(Math.random() * 1000);
      await new Promise((r) => setTimeout(r, delay));
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info(
      { totalScraped, totalUpserted, totalFailed, durationSeconds },
      "GeM Product PBP Notice Scraper finished successfully."
    );

    await recordAuditLog("gem_pbp_scraped", {
      total_scraped: totalScraped,
      total_upserted: totalUpserted,
      total_failed: totalFailed,
      duration_seconds: parseFloat(durationSeconds),
      completed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    log.error({ err: err?.message, stack: err?.stack }, "GeM PBP Scraper encountered an error");
    await recordAuditLog("gem_pbp_failed", {
      error: err?.message,
      failed_at: new Date().toISOString(),
    });
  } finally {
    await browser.close();
  }

  return { totalScraped, totalUpserted, totalFailed };
}

// ─── Direct Script Execution ─────────────────────────────────────────────────

if (process.argv[1]?.endsWith("gemPbpScraper.ts") || process.argv[1]?.endsWith("gemPbpScraper.js")) {
  runGemPbpScraper()
    .then((stats) => {
      console.log("\n=== GeM PBP Notice Scraper Summary ===");
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
