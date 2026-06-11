import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
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

interface DiscoveredRow {
  mstc_auction_number: string;
  seller_name: string;
  category_name: string;
  opening_date: string;
  closing_date: string;
  source_pdf_url: string;
  raw_materials_text: string;
  asset_status: string;
  retry_count: number;
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
              categoryName = cells[1]?.textContent?.trim() || 'Industrial / Commercial Scrap Lots';
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

      return {
        mstc_auction_number,
        seller_name: item.seller_name.substring(0, 255),
        category_name: item.category_name.substring(0, 100),
        location,
        opening_date,
        closing_date,
        source_pdf_url: `https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp?auc=${item.aucId}`,
        raw_materials_text: `Enterprise raw materials ledger managed by ${item.seller_name}. Distribution field index: ${item.category_name}. System Registry Tracking Node ID: ${mstc_auction_number}`,
        asset_status: 'pending',
        retry_count: 0
      };
    });

    const { error: upsertError } = await supabase
      .from('mstc_auctions')
      .upsert(finalRows, { 
        onConflict: 'mstc_auction_number',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('Ingestion Pipeline Conflict Error:', upsertError.message);
      await browser.close();
      return;
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
