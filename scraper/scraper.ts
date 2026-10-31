import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
import https from 'node:https';
import { JSDOM } from 'jsdom';
import { mapCategory } from './utils/categoryMapper.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 60000
});

const mstcHttpClient = axios.create({
  httpsAgent,
  decompress: true,
  timeout: 30000
});

puppeteer.use(StealthPlugin());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL EXCEPTION: Background scraper is missing database environment keys.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export interface DiscoveredRow {
  mstc_auction_number: string;
  seller_name: string;
  category_name: string;
  location: string;
  opening_date: string;
  closing_date: string;
  source_pdf_url: string;
  raw_materials_text: string;
  asset_status: string;
  retry_count: number;
  is_reauction: boolean;
  original_auction_number: string | null;
  parent_auction_id: string | null;
}

const REGION_MAP: Record<string, string> = {
  LKO: 'Uttar Pradesh',
  ERO: 'West Bengal',
  CDG: 'Punjab & Haryana',
  JPR: 'Rajasthan',
  BBR: 'Odisha',
  RNC: 'Jharkhand',
  SRO: 'Tamil Nadu',
  VZG: 'Andhra Pradesh',
  BPL: 'Madhya Pradesh',
  WRO: 'Maharashtra',
  BLR: 'Karnataka',
  TVC: 'Kerala',
  RPR: 'Chhattisgarh',
  VAD: 'Gujarat',
  NRO: 'Delhi & NCR',
  GHY: 'Assam & North East',
  HYD: 'Telangana',
  PTN: 'Bihar'
};

/**
 * Accurately parses opening and closing dates in Indian Standard Time (IST, UTC+05:30).
 */
function parseDates(dateStr: string, durationStr: string): { opening_date: string; closing_date: string } {
  const baselineTime = new Date();
  let opening_date = new Date(baselineTime.getTime() + 12 * 60 * 60 * 1000).toISOString();
  let closing_date = new Date(baselineTime.getTime() + 96 * 60 * 60 * 1000).toISOString();

  // Parse opening date (DD/MM/YYYY)
  if (dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      opening_date = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T00:00:00+05:30`).toISOString();
    }
  }

  // Parse scheduled duration (DD/MM/YYYY HH:mm:ss To DD/MM/YYYY HH:mm:ss)
  if (durationStr) {
    const parts = durationStr.split(' To ');
    const startPart = parts[0]?.trim();
    const closingPart = (parts[1] || parts[0])?.trim();

    if (startPart) {
      const [startDateStr, startTimeStr] = startPart.split(' ');
      const startParts = startDateStr?.split('/');
      if (startParts && startParts.length === 3) {
        opening_date = new Date(`${startParts[2]}-${startParts[1].padStart(2, '0')}-${startParts[0].padStart(2, '0')}T${startTimeStr || '00:00:00'}+05:30`).toISOString();
      }
    }

    if (closingPart) {
      const [closeDateStr, closeTimeStr] = closingPart.split(' ');
      const closeParts = closeDateStr?.split('/');
      if (closeParts && closeParts.length === 3) {
        closing_date = new Date(`${closeParts[2]}-${closeParts[1].padStart(2, '0')}-${closeParts[0].padStart(2, '0')}T${closeTimeStr || '18:00:00'}+05:30`).toISOString();
      }
    }
  }

  return { opening_date, closing_date };
}

/**
 * Resolves location using MSTC regional office codes and seller heuristics.
 */
function parseLocation(mstc_auction_number: string, seller_name: string): string {
  let location = 'India';
  const parts = mstc_auction_number.split('/');
  if (parts.length > 1) {
    const region = parts[1].toUpperCase().trim();
    const sellerLower = (seller_name || '').toLowerCase();
    const numLower = mstc_auction_number.toLowerCase();
    if (
      sellerLower.includes('kochi') ||
      sellerLower.includes('cochin') ||
      numLower.includes('kochi') ||
      numLower.includes('ambalamugal') ||
      sellerLower.includes('ernakulam')
    ) {
      location = 'Kerala';
    } else if (region === 'PTN') {
      location = 'Bihar';
    } else {
      location = REGION_MAP[region] || region;
    }
  }
  return location;
}

/**
 * Parses the HTML table rows returned from MSTC get_event_details.jsp.
 */
/**
 * High-speed parser for MSTC table rows using regex/string scanning, falling back to JSDOM if needed.
 */
function parseMstcHtml(html: string): any[] {
  if (!html || !html.includes('downloadCatalogue')) {
    return [];
  }

  const structuralRows: any[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    if (!rowHtml.includes('downloadCatalogue')) continue;

    const aucMatch = rowHtml.match(/downloadCatalogue\((\d+)\)/);
    const aucId = aucMatch ? aucMatch[1] : '';
    if (!aucId) continue;

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }

    let categoryName = 'Industrial / Commercial Scrap Lots';
    let dateStr = '';
    let durationStr = '';

    if (cells.length > 1 && cells[1]) {
      categoryName = cells[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(', ') || 'Industrial / Commercial Scrap Lots';
    }

    if (cells.length > 3 && cells[3]) {
      dateStr = cells[3].replace(/<[^>]+>/g, '').trim();
    }

    if (cells.length > 4 && cells[4]) {
      durationStr = cells[4].replace(/<[^>]+>/g, '').trim();
    }

    const aMatch = rowHtml.match(/<a[^>]*downloadCatalogue[^>]*>([\s\S]*?)<\/a>/i) ||
                   rowHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const aContent = aMatch ? aMatch[1].replace(/<[^>]+>/g, '\n') : '';
    const lines = aContent.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    const auctionNumber = firstLine.replace(/Download PDF/i, '').trim() || 'MSTC-' + aucId;

    const parts = auctionNumber.split('/');
    let sellerName = 'MSTC Seller';
    if (parts.length > 2) {
      const parsedSeller = parts[2].trim();
      if (parsedSeller) sellerName = parsedSeller;
    }

    structuralRows.push({
      aucId,
      mstc_auction_number: auctionNumber,
      seller_name: sellerName,
      category_name: categoryName,
      dateStr,
      durationStr
    });
  }

  if (structuralRows.length > 0) {
    return structuralRows;
  }

  // Graceful fallback to JSDOM in case table formatting differs
  return parseMstcHtmlWithJsdom(html);
}

function parseMstcHtmlWithJsdom(html: string): any[] {
  const dom = new JSDOM('<table><tbody id="finalAppendBody">' + html + '</tbody></table>');
  const links = Array.from(dom.window.document.querySelectorAll('#finalAppendBody tr a'));

  const targetLinks = links.filter(a => {
    const onclick = a.getAttribute('onclick') || '';
    return onclick.includes('downloadCatalogue');
  });

  const structuralRows: any[] = [];
  targetLinks.forEach((a) => {
    const onclickText = a.getAttribute('onclick') || '';
    const match = onclickText.match(/downloadCatalogue\((\d+)\)/);
    const aucId = match ? match[1] : '';
    if (!aucId) return;

    const row = a.closest('tr');
    let categoryName = 'Industrial / Commercial Scrap Lots';
    let dateStr = '';
    let durationStr = '';

    if (row) {
      const cells = Array.from(row.querySelectorAll('td'));
      const cellHTML = cells[1]?.innerHTML || '';
      categoryName = cellHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(', ') || 'Industrial / Commercial Scrap Lots';
      dateStr = cells[3]?.textContent?.trim() || '';
      durationStr = cells[4]?.textContent?.trim() || '';
    }

    const lines = (a.textContent || '').split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    const auctionNumber = firstLine.replace(/Download PDF/i, '').trim() || 'MSTC-' + aucId;

    const parts = auctionNumber.split('/');
    let sellerName = 'MSTC Seller';
    if (parts.length > 2) {
      const parsedSeller = parts[2].trim();
      if (parsedSeller) sellerName = parsedSeller;
    }

    structuralRows.push({
      aucId,
      mstc_auction_number: auctionNumber,
      seller_name: sellerName,
      category_name: categoryName,
      dateStr,
      durationStr
    });
  });

  return structuralRows;
}

/**
 * Primary high-speed direct HTTP scraper. Fetches CAPTCHA and both Live and Forthcoming catalogues in seconds.
 */
async function fetchMstcViaHttp(): Promise<{ rows: any[]; cookieString: string } | null> {
  try {
    console.log('[1/3] Attempting automated direct HTTP discovery from MSTC...');
    const captchaRes = await mstcHttpClient.post(
      'https://www.mstcecommerce.com/auctionhome/imageverification.jsp',
      null,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://www.mstcecommerce.com/auctionhome/aucsearch/search.jsp',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 15000,
        transformResponse: [(data) => data]
      }
    );

    const rawCookies = captchaRes.headers['set-cookie'] || [];
    const cookieString = rawCookies.map(c => c.split(';')[0]).join('; ');
    const captchaCode = String(captchaRes.data).trim();

    if (!captchaCode) {
      throw new Error('Received empty verification code from imageverification.jsp');
    }
    console.log(`[1/3] Acquired session verification token (${captchaCode}).`);

    console.log('[2/3] Fetching Live and Forthcoming catalogue tables concurrently...');
    const [forthRes, liveRes] = await Promise.all([
      mstcHttpClient.get('https://www.mstcecommerce.com/auctionhome/aucsearch/get_event_details.jsp', {
        params: {
          keyword: '',
          seropt: 'forthauc',
          forthaucchk: 'all',
          captcha: captchaCode
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://www.mstcecommerce.com/auctionhome/aucsearch/search.jsp',
          'Cookie': cookieString,
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 30000,
        transformResponse: [(data) => data]
      }),
      mstcHttpClient.get('https://www.mstcecommerce.com/auctionhome/aucsearch/get_event_details.jsp', {
        params: {
          keyword: '',
          seropt: 'live',
          captcha: captchaCode
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://www.mstcecommerce.com/auctionhome/aucsearch/search.jsp',
          'Cookie': cookieString,
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 30000,
        transformResponse: [(data) => data]
      })
    ]);

    const forthRows = parseMstcHtml(forthRes.data);
    const liveRows = parseMstcHtml(liveRes.data);
    console.log(`[2/3] Retrieved ${liveRows.length} Live and ${forthRows.length} Forthcoming auctions from portal.`);

    const dedupMap = new Map<string, any>();
    for (const r of [...liveRows, ...forthRows]) {
      const key = r.mstc_auction_number || r.aucId;
      if (key && !dedupMap.has(key)) {
        dedupMap.set(key, r);
      }
    }

    const rows = Array.from(dedupMap.values());
    console.log(`[2/3] Total combined unique catalogues: ${rows.length}`);
    return { rows, cookieString };
  } catch (err: any) {
    console.warn('[HTTP Discovery] Direct HTTP fetch failed, falling back to Puppeteer:', err.message);
    return null;
  }
}

/**
 * Fallback Puppeteer scraper for interactive headful mode or network edge cases.
 */
async function fetchMstcViaPuppeteer(headful: boolean): Promise<{ rows: any[]; cookieString: string }> {
  console.log(`[Puppeteer] Launching browser context (headful: ${headful})...`);
  const browser = await puppeteer.launch({
    headless: !headful,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    await page.goto('https://www.mstcecommerce.com/auctionhome/aucsearch/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    let completeInventory: any[] = [];

    if (!headful) {
      console.log('[Puppeteer] Solving CAPTCHA and querying search endpoint directly in browser...');
      const captchaCode = await page.evaluate(async () => {
        const res = await fetch('/auctionhome/imageverification.jsp', { method: 'POST' });
        return (await res.text()).trim();
      });

      const [forthHtml, liveHtml] = await page.evaluate(async (code) => {
        const [fRes, lRes] = await Promise.all([
          fetch(`/auctionhome/aucsearch/get_event_details.jsp?keyword=&seropt=forthauc&forthaucchk=all&captcha=${code}`).then(r => r.text()),
          fetch(`/auctionhome/aucsearch/get_event_details.jsp?keyword=&seropt=live&captcha=${code}`).then(r => r.text())
        ]);
        return [fRes, lRes];
      }, captchaCode);

      completeInventory = [...parseMstcHtml(forthHtml), ...parseMstcHtml(liveHtml)];
    } else {
      console.log('\n[Scraper] Browser window launched. Action Required:');
      console.log('1. Solve CAPTCHA, select options, and click "Search" in the Chrome window.');
      console.log('2. The scraper will automatically detect when search results load.\n');

      let resultsLoaded = false;
      const startTime = Date.now();
      const timeoutMs = 300000;

      while (Date.now() - startTime < timeoutMs) {
        for (const frame of page.frames()) {
          try {
            const count = await frame.evaluate(() => document.querySelectorAll('#finalAppendBody tr a').length);
            if (count > 0) {
              resultsLoaded = true;
              break;
            }
          } catch (_) {}
        }
        if (resultsLoaded) break;
        await new Promise(r => setTimeout(r, 1500));
      }

      for (const frame of page.frames()) {
        try {
          const content = await frame.content();
          const parsed = parseMstcHtml(content);
          if (parsed.length > 0) completeInventory.push(...parsed);
        } catch (_) {}
      }
    }

    const dedupMap = new Map<string, any>();
    completeInventory.forEach(item => {
      const key = item.mstc_auction_number || item.aucId;
      if (key && !dedupMap.has(key)) dedupMap.set(key, item);
    });

    return { rows: Array.from(dedupMap.values()), cookieString };
  } finally {
    await browser.close();
  }
}

/**
 * Updates MetalMandi baseline spot rates non-blockingly.
 */
async function syncMetalMandiRates(): Promise<void> {
  console.log('[MetalMandi] Syncing baseline spot rates...');
  try {
    const { parseMetalMandiRates } = await import('./parsers/metalMandiParser.js');
    await parseMetalMandiRates();
    console.log('[MetalMandi] Baseline spot rates synchronized successfully.');
  } catch (err: any) {
    console.warn('[MetalMandi] Note on baseline rate sync:', err.message);
  }
}

/**
 * Optional batch cleanup of storage files for expired auctions.
 */
async function cleanupExpiredAuctionsBatch(): Promise<void> {
  console.log('[Cleanup] Running batched check for expired auctions...');
  try {
    const nowIso = new Date().toISOString();
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('mstc_auctions')
      .select('id, mstc_auction_number, closing_date, sanitized_document_path')
      .lt('closing_date', nowIso)
      .limit(200);

    if (fetchError || !expiredAuctions || expiredAuctions.length === 0) {
      console.log('[Cleanup] No expired auctions require storage pruning.');
      return;
    }

    console.log(`[Cleanup] Found ${expiredAuctions.length} expired auctions to prune storage files for...`);
    const filesToDelete: string[] = [];
    for (const auc of expiredAuctions) {
      filesToDelete.push(`mstc-catalogs/${auc.id}.pdf`);
      filesToDelete.push(`mstc-previews/${auc.id}.jpg`);
    }

    if (filesToDelete.length > 0) {
      await supabase.storage.from('auction_documents').remove(filesToDelete);
      console.log(`[Cleanup] Pruned ${filesToDelete.length} storage artifacts.`);
    }
  } catch (err: any) {
    console.warn('[Cleanup] Expired auction pruning note:', err.message);
  }
}

/**
 * Main Discovery Scraper Orchestration
 */
export async function executeDiscoveryScraper() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const isHeadful = args.includes('--headful');
  const doCleanup = args.includes('--cleanup-expired');
  const syncRates = args.includes('--with-rates');

  console.log('============================================================');
  console.log('⚡ MSTC Government eAuction Catalogue Discovery Engine');
  console.log('============================================================');

  if (doCleanup) {
    await cleanupExpiredAuctionsBatch();
  }

  // 1. Initiate parallel pipeline: Pre-fetch active DB records concurrently while fetching MSTC portal
  const twoDaysAgoIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const activeRanges = [[0, 999], [1000, 1999], [2000, 2999]];
  const activeDbPrefetchPromise = Promise.all(
    activeRanges.map(([from, to]) =>
      supabase
        .from('mstc_auctions')
        .select('id, mstc_auction_number, asset_status, closing_date, opening_date')
        .gte('closing_date', twoDaysAgoIso)
        .range(from, to)
    )
  );

  let discoveryResult: { rows: any[]; cookieString: string } | null = null;

  console.time('⏱️ [Network + Parsing]');
  if (!isHeadful) {
    discoveryResult = await fetchMstcViaHttp();
  }

  if (!discoveryResult || discoveryResult.rows.length === 0) {
    discoveryResult = await fetchMstcViaPuppeteer(isHeadful);
  }
  console.timeEnd('⏱️ [Network + Parsing]');

  const { rows: completeScrapedInventory, cookieString } = discoveryResult;

  if (completeScrapedInventory.length === 0) {
    console.warn('[Scraper] Parsed 0 items from portal. Halting ingestion.');
    return;
  }

  // Save fresh session cookies to Supabase database for background worker
  console.time('⏱️ [Save Session Cookie]');
  if (cookieString) {
    const { error: cookieError } = await supabase
      .from('ocr_cache')
      .upsert({
        buffer_hash: 'SYSTEM_SESSION_COOKIES',
        ocr_text: cookieString,
        created_at: new Date().toISOString()
      }, { onConflict: 'buffer_hash' });

    if (cookieError) {
      console.warn('Failed to save session cookies to ocr_cache:', cookieError.message);
    } else {
      console.log('[Session] Saved fresh portal session cookies for background asset worker.');
    }
  }
  console.timeEnd('⏱️ [Save Session Cookie]');

  // 2. Standardize rows with accurate IST timestamps & location mapping
  console.time('⏱️ [Row Normalization]');
  const finalRows: DiscoveredRow[] = completeScrapedInventory.map(item => {
    const { opening_date, closing_date } = parseDates(item.dateStr, item.durationStr);
    const location = parseLocation(item.mstc_auction_number, item.seller_name);
    const parsedCat = mapCategory(item.category_name);
    const category_name = `${parsedCat.category} | ${parsedCat.subcategory}`.substring(0, 100);

    let mstc_auction_number = item.mstc_auction_number;
    if (mstc_auction_number.length > 100) {
      const parts = mstc_auction_number.split('/');
      const shortened = parts.map((p: string) => {
        if (p.length > 15) {
          return p.substring(0, 12) + '...';
        }
        return p;
      });
      mstc_auction_number = shortened.join('/').substring(0, 100);
    }

    return {
      mstc_auction_number,
      seller_name: item.seller_name.substring(0, 255),
      category_name,
      location,
      opening_date,
      closing_date,
      source_pdf_url: `https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp?auc=${item.aucId}`,
      raw_materials_text: `Enterprise raw materials ledger managed by ${item.seller_name}. Distribution field index: ${category_name}. System Registry Tracking Node ID: ${mstc_auction_number}`,
      asset_status: 'pending',
      retry_count: 0,
      is_reauction: false,
      original_auction_number: null,
      parent_auction_id: null
    };
  });

  console.timeEnd('⏱️ [Row Normalization]');

  console.log(`[3/3] Synchronizing ${finalRows.length} catalogues with database...`);

  // 3. Fast Batch DB Query: Check existing auction records using 2-phase resolution
  console.time('⏱️ [Database Sync Check]');
  const allNumbers = finalRows.map(r => r.mstc_auction_number);
  const existingMap = new Map<string, any>();

  // Phase 3a: Await pre-fetched active catalogues (already retrieved in parallel during network download)
  const activeResults = await activeDbPrefetchPromise;

  let activeCount = 0;
  activeResults.forEach(res => {
    res.data?.forEach(r => {
      existingMap.set(r.mstc_auction_number, r);
      activeCount++;
    });
  });
  console.log(`[DB Cache] Pre-fetched ${activeCount} active records. Unmapped remaining: ${allNumbers.filter(n => !existingMap.has(n)).length}`);

  // Phase 3b: Any remaining unmapped numbers checked in concurrent parallel batches
  const unmappedNumbers = allNumbers.filter(n => !existingMap.has(n));
  if (unmappedNumbers.length > 0) {
    const chunkSize = 60;
    const chunks: string[][] = [];
    for (let i = 0; i < unmappedNumbers.length; i += chunkSize) {
      chunks.push(unmappedNumbers.slice(i, i + chunkSize));
    }
    const CONCURRENCY = 8;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(chunk =>
          supabase
            .from('mstc_auctions')
            .select('id, mstc_auction_number, asset_status, closing_date, opening_date')
            .in('mstc_auction_number', chunk)
        )
      );
      for (const res of results) {
        res.data?.forEach(r => existingMap.set(r.mstc_auction_number, r));
      }
    }
  }

  const actuallyNewRows = finalRows.filter(r => !existingMap.has(r.mstc_auction_number));
  const existingToUpdate = finalRows.filter(r => {
    const existing = existingMap.get(r.mstc_auction_number);
    if (!existing) return false;
    const existingClose = existing.closing_date ? new Date(existing.closing_date).getTime() : 0;
    const newClose = r.closing_date ? new Date(r.closing_date).getTime() : 0;
    const existingOpen = existing.opening_date ? new Date(existing.opening_date).getTime() : 0;
    const newOpen = r.opening_date ? new Date(r.opening_date).getTime() : 0;
    return existingClose !== newClose || existingOpen !== newOpen;
  });

  console.timeEnd('⏱️ [Database Sync Check]');

  console.log(`[3/3] Breakdown: ${actuallyNewRows.length} brand new, ${existingToUpdate.length} date extensions/updates, ${finalRows.length - actuallyNewRows.length - existingToUpdate.length} already up-to-date.`);

  // 4. Fast O(N) hash-indexed re-auction detection (ONLY for new rows!)
  if (actuallyNewRows.length > 0) {
    console.time('⏱️ [Re-auction Detection]');
    console.log(`[Re-auction] Checking ${actuallyNewRows.length} new auctions for historical parents...`);
    const rowsByGrouping = new Map<string, DiscoveredRow[]>();
    for (const row of finalRows) {
      const key = `${row.seller_name}|${row.location}|${row.category_name}`;
      let list = rowsByGrouping.get(key);
      if (!list) {
        list = [];
        rowsByGrouping.set(key, list);
      }
      list.push(row);
    }

    for (const row of actuallyNewRows) {
      const key = `${row.seller_name}|${row.location}|${row.category_name}`;
      const candidates = rowsByGrouping.get(key);
      if (!candidates) continue;

      for (const otherRow of candidates) {
        if (
          otherRow.mstc_auction_number !== row.mstc_auction_number &&
          otherRow.opening_date < row.opening_date
        ) {
          row.is_reauction = true;
          row.original_auction_number = otherRow.mstc_auction_number;
          break;
        }
      }
    }
    console.timeEnd('⏱️ [Re-auction Detection]');

    // 5. Batched analytics tracking for new items
    console.time('⏱️ [Daily Analytics & New Rows Upsert]');
    console.log(`[Analytics] Recording daily discovery stats for ${actuallyNewRows.length} items...`);
    const today = new Date().toISOString().split('T')[0];
    const statsMap: Record<string, number> = {};
    actuallyNewRows.forEach(row => {
      const cat = row.category_name || 'Uncategorized';
      statsMap[cat] = (statsMap[cat] || 0) + 1;
    });

    const categoryNames = Object.keys(statsMap);
    if (categoryNames.length > 0) {
      const { data: existingStats } = await supabase
        .from('category_daily_stats')
        .select('id, category_name, items_added')
        .eq('date', today)
        .in('category_name', categoryNames);

      const existingByName = new Map<string, any>();
      existingStats?.forEach(s => existingByName.set(s.category_name, s));

      const updates: PromiseLike<any>[] = [];
      const inserts: any[] = [];

      for (const [category, count] of Object.entries(statsMap)) {
        const existing = existingByName.get(category);
        if (existing) {
          updates.push(
            supabase
              .from('category_daily_stats')
              .update({ items_added: existing.items_added + count })
              .eq('id', existing.id)
          );
        } else {
          inserts.push({
            date: today,
            category_name: category,
            items_added: count
          });
        }
      }

      await Promise.all([
        ...updates,
        inserts.length > 0
          ? supabase.from('category_daily_stats').insert(inserts)
          : Promise.resolve()
      ]);
    }

    // Upsert new rows into mstc_auctions in concurrent waves of 100
    const insertChunks: DiscoveredRow[][] = [];
    for (let i = 0; i < actuallyNewRows.length; i += 100) {
      insertChunks.push(actuallyNewRows.slice(i, i + 100));
    }

    const INSERT_CONCURRENCY = 5;
    for (let i = 0; i < insertChunks.length; i += INSERT_CONCURRENCY) {
      const wave = insertChunks.slice(i, i + INSERT_CONCURRENCY);
      await Promise.all(
        wave.map(chunk =>
          supabase
            .from('mstc_auctions')
            .upsert(chunk, { onConflict: 'mstc_auction_number', ignoreDuplicates: true })
        )
      );
    }
    console.timeEnd('⏱️ [Daily Analytics & New Rows Upsert]');
  }

  // 6. Update date extensions on existing auctions concurrently without touching asset_status
  if (existingToUpdate.length > 0) {
    console.time('⏱️ [Date Extensions Update]');
    console.log(`[Updates] Updating closing/opening schedules on ${existingToUpdate.length} extended auctions...`);
    const batchSize = 50;
    for (let i = 0; i < existingToUpdate.length; i += batchSize) {
      const slice = existingToUpdate.slice(i, i + batchSize);
      await Promise.all(slice.map(item =>
        supabase
          .from('mstc_auctions')
          .update({
            closing_date: item.closing_date,
            opening_date: item.opening_date,
            location: item.location
          })
          .eq('mstc_auction_number', item.mstc_auction_number)
      ));
    }
    console.timeEnd('⏱️ [Date Extensions Update]');
  }

  if (syncRates) {
    await syncMetalMandiRates();
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('============================================================');
  console.log(`✨ Discovery pipeline completed in ${elapsedSec}s!`);
  console.log(`📊 Total Catalogues Online: ${finalRows.length} (${actuallyNewRows.length} added, ${existingToUpdate.length} updated)`);
  console.log('============================================================');
}

// Execute discovery scraper when run directly as CLI
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('scraper/scraper.ts') ||
  process.argv[1].endsWith('scraper/scraper.js') ||
  process.argv[1].includes('scraper.ts')
);

if (isDirectCli) {
  executeDiscoveryScraper().catch((err) => {
    console.error('Fatal execution error in discovery scraper:', err);
    process.exit(1);
  });
}
