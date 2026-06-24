import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import readline from 'readline';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();
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

import { mapCategory } from './utils/categoryMapper.js';

interface DiscoveredRow {
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

function waitForUserConfirmation(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function executeDiscoveryScraper() {
  console.log('[Cleanup] Checking for expired auctions...');
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoIso = oneWeekAgo.toISOString();
    
    // 1. Fetch expired auctions older than 1 week
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('mstc_auctions')
      .select('id, mstc_auction_number, closing_date, sanitized_document_path')
      .lt('closing_date', oneWeekAgoIso);

    if (fetchError) {
      console.error('[Cleanup] Error fetching expired auctions:', fetchError.message);
    } else if (expiredAuctions && expiredAuctions.length > 0) {
      console.log(`[Cleanup] Found ${expiredAuctions.length} expired auctions. Logging and deleting...`);

      // 2. Insert audit logs for deleted auctions
      const logEntries = expiredAuctions.map(auc => ({
        action: 'mstc_auction_deleted',
        entity_type: 'mstc_auction',
        details: {
          mstc_auction_number: auc.mstc_auction_number,
          reason: 'expired',
          closing_date: auc.closing_date,
          sanitized_document_path: auc.sanitized_document_path
        }
      }));

      const { error: logError } = await supabase
        .from('audit_logs')
        .insert(logEntries);

      if (logError) {
        console.error('[Cleanup] Error writing audit logs for expired auctions:', logError.message);
      }

      // 3. Remove physical files from storage
      for (const auc of expiredAuctions) {
        if (auc.sanitized_document_path) {
          const cloudStorageLocation = `mstc-catalogs/${auc.id}.pdf`;
          const previewStorageLocation = `mstc-previews/${auc.id}.jpg`;
          
          const { error: storageDeleteError } = await supabase.storage
            .from('auction_documents')
            .remove([cloudStorageLocation, previewStorageLocation]);

          if (storageDeleteError) {
            console.warn(`[Cleanup] Failed to remove storage file ${cloudStorageLocation}:`, storageDeleteError.message);
          } else {
            console.log(`[Cleanup] Removed storage file: ${cloudStorageLocation}`);
          }
        }
      }

      // 4. Delete database records
      const idsToDelete = expiredAuctions.map(auc => auc.id);
      const { error: deleteError } = await supabase
        .from('mstc_auctions')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('[Cleanup] Error deleting expired auctions:', deleteError.message);
      } else {
        console.log(`[Cleanup] Expired auctions cleanup complete. Removed ${expiredAuctions.length} database records.`);
      }
    } else {
      console.log('[Cleanup] No expired auctions found.');
    }
  } catch (err: any) {
    console.error('[Cleanup] Exception during expired auctions cleanup:', err.message);
  }

  console.log('[1/3] Launching interactive browser context...');
  console.log('------------------------------------------------------------');
  console.log('ACTION REQUIRED:');
  console.log('1. A Chrome browser window will open.');
  console.log('2. Select your filters, solve the CAPTCHA, and click "Search".');
  console.log('3. Once the search results page loads, return here and press [Enter].');
  console.log('------------------------------------------------------------');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    await page.goto('https://www.mstcecommerce.com/auctionhome/aucsearch/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the user to press Enter in the terminal
    await waitForUserConfirmation('\nPress [Enter] here once the search results page has finished loading...\n');

    // Save session cookies to a local file for the background worker
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    fs.writeFileSync('cookies.txt', cookieString, 'utf-8');
    console.log('Session cookies saved to cookies.txt for background worker.');

    console.log('[Diagnostics] Dumping page HTML to debug_page.html for inspection...');
    const mainHtml = await page.content();
    fs.writeFileSync('debug_page.html', `<!-- MAIN FRAME HTML -->\n${mainHtml}`);
    
    const frames = page.frames();
    console.log(`[Diagnostics] Found ${frames.length} frames/iframes on the page.`);
    for (let i = 0; i < frames.length; i++) {
      try {
        const frameHtml = await frames[i].content();
        fs.appendFileSync('debug_page.html', `\n\n<!-- FRAME ${i} HTML (URL: ${frames[i].url()}) -->\n${frameHtml}`);
      } catch (e: any) {
        console.warn(`Could not dump frame ${i}:`, e.message);
      }
    }
    console.log('[Diagnostics] HTML dump complete. Checking elements...');

    console.log('[2/3] Extracting structural rows from search results page...');

    const completeScrapedInventory: any[] = [];
    const framesToScrape = page.frames();

    for (const frame of framesToScrape) {
      try {
        const parsedBatch = await frame.evaluate(() => {
          const structuralRows: any[] = [];
          const links = Array.from(document.querySelectorAll('#finalAppendBody tr a'));
          
          const targetLinks = links.filter(a => {
            const onclick = a.getAttribute('onclick') || '';
            return onclick.includes('downloadCatalogue');
          });

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

            const firstLine = a.textContent?.split('\n')[0].trim() || '';
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
        });

        if (parsedBatch && parsedBatch.length > 0) {
          completeScrapedInventory.push(...parsedBatch);
        }
      } catch (frameErr: any) {
        console.warn('Frame scanning warning:', frameErr.message);
      }
    }

    if (completeScrapedInventory.length === 0) {
      console.warn('Scraper parsed 0 items. Ingestion execution halted.');
      await browser.close();
      return;
    }

    console.log(`[3/3] Found ${completeScrapedInventory.length} items. Mapping and merging into database...`);

    const finalRows: DiscoveredRow[] = completeScrapedInventory.map(item => {
      const baselineTime = new Date();
      let opening_date = new Date(baselineTime.getTime() + 12 * 60 * 60 * 1000).toISOString();
      let closing_date = new Date(baselineTime.getTime() + 96 * 60 * 60 * 1000).toISOString();

      // Parse opening date (DD/MM/YYYY)
      if (item.dateStr) {
        const parts = item.dateStr.split('/');
        if (parts.length === 3) {
          opening_date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).toISOString();
        }
      }

      // Parse closing date (DD/MM/YYYY HH:mm:ss)
      if (item.durationStr) {
        const parts = item.durationStr.split(' To ');
        const closingPart = parts[1] || parts[0];
        if (closingPart) {
          const dateAndTime = closingPart.split(' ');
          const dateComponents = dateAndTime[0]?.split('/');
          const timeComponents = dateAndTime[1];
          if (dateComponents && dateComponents.length === 3) {
            closing_date = new Date(`${dateComponents[2]}-${dateComponents[1]}-${dateComponents[0]}T${timeComponents || '18:00:00'}Z`).toISOString();
          }
        }
      }

      // Shorten the auction number to fit in character varying(100)
      let mstc_auction_number = item.mstc_auction_number;
      let location = 'India';
      const parts = mstc_auction_number.split('/');
      
      if (parts.length > 1) {
        const region = parts[1].toUpperCase().trim();
        const regionMap: Record<string, string> = {
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
          HYD: 'Telangana'
        };
        location = regionMap[region] || region;
      }

      if (mstc_auction_number.length > 100) {
        const shortened = parts.map((p: string) => {
          if (p.length > 15) {
            return p.substring(0, 12) + '...';
          }
          return p;
        });
        mstc_auction_number = shortened.join('/').substring(0, 100);
      }

      const parsed = mapCategory(item.category_name);
      const category_name = `${parsed.category} | ${parsed.subcategory}`;

      return {
        mstc_auction_number,
        seller_name: item.seller_name.substring(0, 255),
        category_name: category_name.substring(0, 100),
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

    console.log("Analyzing batch for potential re-auctions...");
    for (const row of finalRows) {
      // 1. Query DB for potential older matching parent auction
      const { data: dbMatches, error: dbError } = await supabase
        .from('mstc_auctions')
        .select('id, mstc_auction_number, opening_date')
        .eq('seller_name', row.seller_name)
        .eq('location', row.location)
        .eq('category_name', row.category_name)
        .neq('mstc_auction_number', row.mstc_auction_number)
        .lt('opening_date', row.opening_date)
        .order('opening_date', { ascending: false });

      if (dbError) {
        console.error(`[Re-auction Check] Error querying DB for parent of ${row.mstc_auction_number}:`, dbError.message);
        continue;
      }

      let parent = dbMatches && dbMatches.length > 0 ? dbMatches[0] : null;

      // 2. Query within current batch for potential older matching parent auction
      for (const otherRow of finalRows) {
        if (
          otherRow.mstc_auction_number !== row.mstc_auction_number &&
          otherRow.seller_name === row.seller_name &&
          otherRow.location === row.location &&
          otherRow.category_name === row.category_name &&
          otherRow.opening_date < row.opening_date
        ) {
          if (!parent || new Date(otherRow.opening_date).getTime() > new Date(parent.opening_date).getTime()) {
            parent = {
              id: null as any,
              mstc_auction_number: otherRow.mstc_auction_number,
              opening_date: otherRow.opening_date
            };
          }
        }
      }

      if (parent) {
        row.is_reauction = true;
        row.original_auction_number = parent.mstc_auction_number;
        if (parent.id) {
          row.parent_auction_id = parent.id;
        }
      }
    }

    const { error: upsertError } = await supabase
      .from('mstc_auctions')
      .upsert(finalRows, { 
        onConflict: 'mstc_auction_number',
        ignoreDuplicates: true 
      });

    if (upsertError) {
      console.error('Ingestion Pipeline Conflict Error:', upsertError.message);
      await browser.close();
      return;
    }

    // Resolve parent_auction_id references for re-auctions whose parents were in the same batch
    const reauctionsWithoutParentId = finalRows.filter(r => r.is_reauction && !r.parent_auction_id);
    if (reauctionsWithoutParentId.length > 0) {
      console.log(`Resolving parent IDs for ${reauctionsWithoutParentId.length} batch-internal re-auctions...`);
      const originalNumbers = reauctionsWithoutParentId.map(r => r.original_auction_number).filter(Boolean) as string[];
      if (originalNumbers.length > 0) {
        const { data: parentsData, error: parentsError } = await supabase
          .from('mstc_auctions')
          .select('id, mstc_auction_number')
          .in('mstc_auction_number', originalNumbers);

        if (!parentsError && parentsData) {
          const parentIdMap = new Map<string, string>();
          parentsData.forEach(p => parentIdMap.set(p.mstc_auction_number, p.id));

          for (const row of reauctionsWithoutParentId) {
            if (row.original_auction_number) {
              const pid = parentIdMap.get(row.original_auction_number);
              if (pid) {
                row.parent_auction_id = pid;
                await supabase
                  .from('mstc_auctions')
                  .update({ parent_auction_id: pid })
                  .eq('mstc_auction_number', row.mstc_auction_number);
              }
            }
          }
        }
      }
    }

    console.log(`Deduplicated data merge complete. Saved ${finalRows.length} records.`);
    console.log('Database records populated as pending. Please start the background worker (npx tsx assetWorker.ts) to upload documents.');

  } catch (error) {
    console.error('System fault caught during execution layer:', error);
  } finally {
    await browser.close();
  }
}

executeDiscoveryScraper();