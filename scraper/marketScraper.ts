import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { scrapeSalasar } from './parsers/salasarParser';

puppeteer.use(StealthPlugin());

interface RawData {
  component: string;
  priceStr: string;
  source: string;
  city: string;
  url?: string;
}

interface ParsedData extends RawData {
  normalizedComponent: string;
  parsedPriceMT: number;
}

interface ScrapedProductEntry {
  originalName: string;
  source: string;
  city: string;
  priceMT: number;
  priceStr: string;
  url?: string;
}

interface SubcategoryGroup {
  averagePriceMT: string;
  sourcesAveraged: number;
  parentCategory: string;
  entries: ScrapedProductEntry[];
}

interface CategoryGroup {
  averagePriceMT: string;
  sourcesAveraged: number;
  subcategories: string[];
}

function parsePriceToMT(priceStr: string, source: string): number | null {
  const clean = priceStr.toLowerCase().replace(/,/g, '');
  const match = clean.match(/\d+(\.\d+)?/);
  if (!match) return null;
  
  let val = parseFloat(match[0]);
  
  // Convert to MT
  if (clean.includes('kg') || clean.includes('kilogram')) {
    val = val * 1000;
  } else if (clean.includes('gram') && !clean.includes('kilogram')) {
    val = val * 1000000;
  } else if (clean.includes('ton') || clean.includes('mt')) {
    val = val * 1;
  } else {
    // Default assumption based on source
    if (source === 'ScrapRates') val = val * 1000; // ScrapRates is per kg
    if (source === 'RecycleInMe') val = val * 1000; // Default to kg
    if (val < 1000) val = val * 1000; // If price is < 1000 INR, it's definitely per Kg.
  }
  return val;
}

function normalizeComponent(name: string): string {
  const norm = name.toLowerCase();
  
  // 1. Aluminium (including spelling mistakes and wheels)
  if (
    norm.includes('aluminium') || norm.includes('aluminum') || 
    norm.includes('alminium') || norm.includes('alumnium') ||
    (norm.includes('wheel') && (norm.includes('alloy') || norm.includes('bike') || norm.includes('car')))
  ) {
    return 'aluminium';
  }
  
  // 2. Copper
  if (norm.includes('copper')) {
    return 'copper';
  }
  
  // 3. Brass
  if (norm.includes('brass')) {
    return 'brass';
  }
  
  // 4. Battery / Lead Acid
  if (norm.includes('battery') || norm.includes('lead acid') || norm.includes('inverter')) {
    return 'battery';
  }
  
  // 5. Lead (pure)
  if (norm.includes('lead') && !norm.includes('lead acid') && !norm.includes('battery')) {
    return 'lead';
  }
  
  // 6. Zinc
  if (norm.includes('zinc')) {
    return 'zinc';
  }

  // 7. Nickel & Alloys (Monel, Inconel, Hastelloy, Cobalt, Cupro, Stellite)
  if (
    norm.includes('alloy') || norm.includes('nickel') || norm.includes('monel') || 
    norm.includes('inconel') || norm.includes('inconal') || norm.includes('hastelloy') || 
    norm.includes('stellite') || norm.includes('cobalt') || norm.includes('cupro')
  ) {
    return 'nickel alloys';
  }

  // 8. Tungsten Carbide
  if (norm.includes('tungsten') || norm.includes('carbide')) {
    return 'tungsten carbide';
  }

  // 9. Molybdenum
  if (norm.includes('molybdenum') || norm.includes('moly')) {
    return 'molybdenum';
  }

  // 10. Titanium
  if (norm.includes('titanium')) {
    return 'titanium';
  }

  // 11. Gun Metal & Bronze
  if (norm.includes('gun metal') || norm.includes('gunmetal') || norm.includes('bronze')) {
    return 'gun metal & bronze';
  }
  
  // 12. Steel & Iron (including bearings, rails, castings)
  if (
    norm.includes('steel') || norm.includes('iron') || norm.includes('hms') || 
    norm.includes('ms') || norm.includes('cast iron') || norm.includes('ci ') || 
    norm.includes('crc') || norm.includes('crca') || norm.includes('rail') || 
    norm.includes('bearing') || norm.includes('busheling') || norm.includes('boring') || 
    norm.includes('structural') || norm.includes('danda') || norm.includes('turnings') ||
    norm.includes('foundry') || norm.includes('metal') || norm.includes('car body')
  ) {
    return 'steel / iron';
  }
  
  // 13. Plastics
  if (
    norm.includes('plastic') || norm.includes('hdpe') || norm.includes('ldpe') || 
    norm.includes('pvc') || norm.includes('pp') || norm.includes('pet') || 
    norm.includes('crates') || norm.includes('dabba') || norm.includes('film') ||
    norm.includes('grinding') || norm.includes('regrind') || norm.includes('chindi') ||
    norm.includes('peek') || norm.includes('nylon')
  ) {
    return 'plastic';
  }
  
  // 14. Paper
  if (
    norm.includes('paper') || norm.includes('newspaper') || norm.includes('craft') || 
    norm.includes('cardboard') || norm.includes('carton')
  ) {
    return 'paper';
  }
  
  // 15. E-Waste & Electronics
  if (
    norm.includes('e-waste') || norm.includes('ewaste') || norm.includes('computer') || 
    norm.includes('laptop') || norm.includes('motherboard') || norm.includes('cpu') || 
    norm.includes('monitor') || norm.includes('processor') || norm.includes('server') || 
    norm.includes('electronic') || norm.includes('ups') || norm.includes('converter')
  ) {
    return 'e-waste';
  }

  // 16. Compressors & Motors
  if (norm.includes('compressor') || norm.includes('motor') || norm.includes('engine') || norm.includes('pump')) {
    return 'compressors & motors';
  }

  // Fallback
  let cleaned = norm.replace(/scrap/g, '')
                    .replace(/waste/g, '')
                    .replace(/rate today/g, '')
                    .replace(/\b(price|prices|rate|rates)\b/g, '')
                    .replace(/[^a-z0-9 ]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
  return cleaned;
}

interface ClassifiedItem {
  category: 'Metals' | 'Electronics' | 'Vehicles' | 'Energy' | 'Others' | 'Agriculture';
  subcategory: string;
}

function classifyItem(name: string, url: string, source: string): ClassifiedItem {
  const norm = name.toLowerCase();
  
  let category: 'Metals' | 'Electronics' | 'Vehicles' | 'Energy' | 'Others' | 'Agriculture' = 'Others';
  let subcategory = 'Miscellaneous';
  
  // Metals
  if (
    norm.includes('metal') || norm.includes('copper') || norm.includes('aluminium') || norm.includes('aluminum') ||
    norm.includes('alminium') || norm.includes('alumnium') || norm.includes('wheel') ||
    norm.includes('iron') || norm.includes('steel') || norm.includes('brass') || norm.includes('lead') ||
    norm.includes('zinc') || norm.includes('bronze') || norm.includes('nickel') || norm.includes('alloy') ||
    norm.includes('wire') || norm.includes('cable') || norm.includes('melting') || norm.includes('hms') ||
    norm.includes('shredded') || norm.includes('cast iron') || norm.includes('carbide') || norm.includes('dross') ||
    norm.includes('boring') || norm.includes('ingot') || norm.includes('pig iron') || norm.includes('inconel') ||
    norm.includes('molybdenum') || norm.includes('titanium') || norm.includes('monel') || norm.includes('hastelloy') ||
    norm.includes('stellite') || norm.includes('cobalt') || norm.includes('cupro') || norm.includes('bearing') ||
    norm.includes('gun metal') || norm.includes('gunmetal')
  ) {
    category = 'Metals';
    if (norm.includes('copper')) {
      subcategory = 'Copper';
    } else if (
      norm.includes('aluminium') || norm.includes('aluminum') || 
      norm.includes('alminium') || norm.includes('alumnium') || norm.includes('wheel')
    ) {
      subcategory = 'Aluminium';
    } else if (norm.includes('brass')) {
      subcategory = 'Brass';
    } else if (norm.includes('lead') && !norm.includes('lead acid') && !norm.includes('battery')) {
      subcategory = 'Lead';
    } else if (norm.includes('zinc')) {
      subcategory = 'Zinc';
    } else if (
      norm.includes('alloy') || norm.includes('nickel') || norm.includes('monel') || 
      norm.includes('inconel') || norm.includes('inconal') || norm.includes('hastelloy') || 
      norm.includes('stellite') || norm.includes('cobalt') || norm.includes('cupro')
    ) {
      subcategory = 'Nickel Alloys';
    } else if (norm.includes('tungsten') || norm.includes('carbide')) {
      subcategory = 'Tungsten Carbide';
    } else if (norm.includes('molybdenum') || norm.includes('moly')) {
      subcategory = 'Molybdenum';
    } else if (norm.includes('titanium')) {
      subcategory = 'Titanium';
    } else if (norm.includes('gun metal') || norm.includes('gunmetal') || norm.includes('bronze')) {
      subcategory = 'Gun Metal & Bronze';
    } else if (
      norm.includes('steel') || norm.includes('iron') || norm.includes('hms') || norm.includes('ms') ||
      norm.includes('bearing') || norm.includes('busheling') || norm.includes('boring') || norm.includes('cast iron')
    ) {
      subcategory = 'Steel & Iron';
    } else {
      subcategory = 'Other Metals';
    }
  }
  // Batteries & E-Waste
  else if (
    norm.includes('battery') || norm.includes('lead acid') || norm.includes('e-waste') || 
    norm.includes('ewaste') || norm.includes('computer') || norm.includes('laptop') || 
    norm.includes('motherboard') || norm.includes('cpu') || norm.includes('monitor') || 
    norm.includes('processor') || norm.includes('server') || norm.includes('electronic') || 
    norm.includes('ups') || norm.includes('converter')
  ) {
    if (norm.includes('battery') || norm.includes('lead acid')) {
      category = 'Metals';
      subcategory = 'Battery';
    } else {
      category = 'Electronics';
      if (norm.includes('computer') || norm.includes('laptop') || norm.includes('cpu') || norm.includes('motherboard')) {
        subcategory = 'Computers & IT';
      } else {
        subcategory = 'E-Waste';
      }
    }
  }
  // Vehicles
  else if (norm.includes('vehicle') || norm.includes('car') || norm.includes('truck') || norm.includes('bus') || norm.includes('auto')) {
    category = 'Vehicles';
    subcategory = 'Automotive Scrap';
  }
  // Energy
  else if (norm.includes('coal') || norm.includes('oil') || norm.includes('gas') || norm.includes('fuel')) {
    category = 'Energy';
    if (norm.includes('coal')) {
      subcategory = 'Coal';
    } else if (norm.includes('gas')) {
      subcategory = 'Natural Gas';
    } else {
      subcategory = 'Waste Oil & Fuel';
    }
  }
  // Agriculture
  else if (norm.includes('wheat') || norm.includes('rice') || norm.includes('maize') || norm.includes('corn') || norm.includes('grain')) {
    category = 'Agriculture';
    if (norm.includes('wheat')) {
      subcategory = 'Wheat';
    } else if (norm.includes('rice')) {
      subcategory = 'Rice';
    } else {
      subcategory = 'Other Grains';
    }
  }
  // Others
  else {
    category = 'Others';
    if (
      norm.includes('plastic') || norm.includes('hdpe') || norm.includes('ldpe') || 
      norm.includes('pvc') || norm.includes('pp') || norm.includes('pet') || 
      norm.includes('crates') || norm.includes('dabba') || norm.includes('film') ||
      norm.includes('grinding') || norm.includes('regrind') || norm.includes('chindi') ||
      norm.includes('peek') || norm.includes('nylon')
    ) {
      subcategory = 'Plastics';
    } else if (
      norm.includes('paper') || norm.includes('newspaper') || norm.includes('craft') || 
      norm.includes('cardboard') || norm.includes('carton')
    ) {
      subcategory = 'Paper & Cardboard';
    } else if (norm.includes('glass')) {
      subcategory = 'Glass';
    } else if (norm.includes('rubber') || norm.includes('tyre') || norm.includes('tire')) {
      subcategory = 'Rubber';
    } else if (norm.includes('sand') || norm.includes('immovable') || norm.includes('property') || norm.includes('land')) {
      subcategory = 'Sand & Immovable';
    } else if (norm.includes('compressor') || norm.includes('motor') || norm.includes('engine') || norm.includes('pump')) {
      subcategory = 'Compressors & Motors';
    }
  }

  return { category, subcategory };
}

async function scrapeScrapRates(page: any): Promise<RawData[]> {
  const allData: RawData[] = [];
  let cities = ['thiruvananthapuram', 'delhi', 'mumbai', 'chennai', 'bengaluru'];
  try {
    console.log('[ScrapRates] Discovering all available cities...');
    await page.goto('https://scraprates.in', { waitUntil: 'networkidle2', timeout: 30000 });
    const discoveredCities = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const cityLinks = links
        .map(a => a.getAttribute('href') || '')
        .filter(href => href.startsWith('/') && !href.includes('state') && href.length > 3)
        .map(href => href.replace('/', '').trim());
      const ignore = ['about', 'contact', 'privacy', 'terms', 'blog', 'dealer-login', 'submit-business', '#search'];
      return cityLinks.filter(c => !ignore.includes(c) && !c.includes('/'));
    });
    if (discoveredCities.length > 0) {
      cities = Array.from(new Set([...cities, ...discoveredCities]));
    }
  } catch (err: any) {
    console.warn(`[ScrapRates] Failed discovery: ${err.message}`);
  }

  for (const city of cities) {
    try {
      const cityUrl = `https://scraprates.in/${city}`;
      await page.goto(cityUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const data = await page.evaluate((cityName: string, currentUrl: string) => {
        const rows = Array.from(document.querySelectorAll('.price-table__row'));
        return rows.map(row => {
          const component = row.querySelector('.price-table__item')?.textContent?.trim() || '';
          const priceStr = row.querySelector('.price-table__price')?.textContent?.trim() || '';
          return { component, priceStr, source: 'ScrapRates', city: cityName, url: currentUrl };
        }).filter(item => item.component && item.priceStr);
      }, city, cityUrl);
      if (data && data.length > 0) allData.push(...data);
    } catch (err: any) {}
  }
  return allData;
}

async function scrapeRecycleInMe(page: any): Promise<RawData[]> {
  const allData: RawData[] = [];
  const urls = [
    // Scrap Prices
    'https://www.recycleinme.com/scrappricelisting/Indian%20Scrap%20Prices',
    'https://www.recycleinme.com/scrappricelisting/USA%20Scrap%20Prices',
    'https://www.recycleinme.com/scrappricelisting/China%20Scrap%20Prices',
    'https://www.recycleinme.com/scrappricelisting/European%20Scrap%20Prices',
    'https://www.recycleinme.com/scrappricelisting/UK%20Scrap%20Prices',
    // Metal Prices
    'https://www.recycleinme.com/metalpricelisting/Indian%20Metal%20Prices',
    'https://www.recycleinme.com/metalpricelisting/USA%20Metal%20Prices',
    'https://www.recycleinme.com/metalpricelisting/European%20Metal%20Prices',
    'https://www.recycleinme.com/metalpricelisting/UK%20Metal%20Prices',
    // Plastic Prices
    'https://www.recycleinme.com/plasticpricelisting/Indian%20Plastic%20Prices',
    'https://www.recycleinme.com/plasticpricelisting/USA%20Plastic%20Prices',
    'https://www.recycleinme.com/plasticpricelisting/European%20Plastic%20Prices',
    'https://www.recycleinme.com/plasticpricelisting/UK%20Plastic%20Prices'
  ];

  for (const url of urls) {
    try {
      console.log(`[RecycleInMe] Scraping list: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const data = await page.evaluate((currentUrl: string) => {
        const results: any[] = [];
        const rows = Array.from(document.querySelectorAll('table tr'));
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 2) {
            const component = cells[0].textContent?.trim() || '';
            const priceStr = cells[1].textContent?.trim() || '';
            if (component && priceStr && /\d/.test(priceStr)) {
              results.push({ component, priceStr, source: 'RecycleInMe', city: 'Global/National', url: currentUrl });
            }
          }
        });
        return results;
      }, url);
      allData.push(...data);
    } catch (err: any) {}
  }
  return allData;
}

async function scrapeIndiaMart(page: any): Promise<RawData[]> {
  const allData: RawData[] = [];
  const seedUrls = [
    'https://dir.indiamart.com/impcat/metal-scrap.html',
    'https://dir.indiamart.com/impcat/copper-scrap.html',
    'https://dir.indiamart.com/impcat/aluminium-scrap.html',
    'https://dir.indiamart.com/impcat/iron-scrap.html',
    'https://dir.indiamart.com/impcat/steel-scrap.html',
    'https://dir.indiamart.com/impcat/brass-scrap.html',
    'https://dir.indiamart.com/impcat/plastic-scrap.html',
    'https://dir.indiamart.com/impcat/paper-scrap.html',
    'https://dir.indiamart.com/impcat/e-waste-scrap.html',
    'https://dir.indiamart.com/impcat/battery-scrap.html',
    'https://dir.indiamart.com/impcat/glass-scrap.html',
    'https://dir.indiamart.com/impcat/rubber-scrap.html',
    'https://dir.indiamart.com/impcat/computer-scrap.html',
    'https://dir.indiamart.com/impcat/zinc-scrap.html'
  ];

  const urlsToScrape = new Set<string>(seedUrls);
  const visitedUrls = new Set<string>();
  const maxPages = 40; // Safely crawl up to 40 category/subcategory pages
  let pageCount = 0;

  console.log(`[IndiaMart] Starting dynamic category crawl from ${seedUrls.length} seeds...`);

  while (urlsToScrape.size > 0 && pageCount < maxPages) {
    const url = Array.from(urlsToScrape)[0];
    urlsToScrape.delete(url);
    visitedUrls.add(url);
    pageCount++;

    console.log(`[IndiaMart] Crawling category page ${pageCount}/${maxPages}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Delay to mimic human speed and prevent soft bans
      await new Promise(res => setTimeout(res, 2000));

      // Scroll down repeatedly to load lazy-loaded elements
      await page.evaluate(async () => {
        for (let i = 0; i < 2; i++) {
          window.scrollBy(0, window.innerHeight * 1.5);
          await new Promise(res => setTimeout(res, 500));
        }
      });

      // Extract products and related subcategory links
      const pageResult = await page.evaluate((currentUrl: string) => {
        const results: any[] = [];
        
        // 1. Extract products
        const priceElems = Array.from(document.querySelectorAll('.prc, .price, [class*="price"]'));
        priceElems.forEach(el => {
          const priceStr = el.textContent?.trim() || '';
          if (!/\d/.test(priceStr)) return;
          let container = el.parentElement;
          let component = '';
          let city = 'India';
          for (let i = 0; i < 6; i++) {
            if (!container) break;
            const titleEl = container.querySelector('h2, h3, .prdtitle, [class*="title"], [class*="name"]');
            if (titleEl && titleEl.textContent) {
              component = titleEl.textContent.trim();
              const cityEl = container.querySelector('.city, .loc, [class*="city"], [class*="loc"]');
              if (cityEl && cityEl.textContent) city = cityEl.textContent.trim();
              break;
            }
            container = container.parentElement;
          }
          if (component && priceStr) {
            results.push({ component, priceStr, source: 'IndiaMart', city, url: currentUrl });
          }
        });

        // 2. Discover other subcategory (/impcat/) pages
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const discovered: string[] = [];
        anchors.forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href.startsWith('/impcat/') && href.endsWith('.html') && !href.includes('hindi.indiamart')) {
            discovered.push('https://dir.indiamart.com' + href);
          } else if (href.startsWith('https://dir.indiamart.com/impcat/') && href.endsWith('.html')) {
            discovered.push(href);
          }
        });

        return { results, discovered };
      }, url);

      // Add products
      if (pageResult.results && pageResult.results.length > 0) {
        allData.push(...pageResult.results);
        console.log(`[IndiaMart] Found ${pageResult.results.length} products on page.`);
      }

      // Add discovered links to queue
      if (pageResult.discovered && pageResult.discovered.length > 0) {
        pageResult.discovered.forEach((discoveredUrl: string) => {
          const cleanUrl = discoveredUrl.split('#')[0].split('?')[0];
          if (!visitedUrls.has(cleanUrl) && !urlsToScrape.has(cleanUrl)) {
            if (urlsToScrape.size < maxPages * 2) {
              urlsToScrape.add(cleanUrl);
            }
          }
        });
      }
    } catch (err: any) {
      console.warn(`[IndiaMart] Failed to scrape page ${url}: ${err.message}`);
    }
  }

  // Deduplicate products by component name
  const unique = new Map();
  allData.forEach(item => {
    if (!unique.has(item.component)) {
      unique.set(item.component, item);
    }
  });

  return Array.from(unique.values());
}

async function scrapeGlobalCommodities(page: any): Promise<RawData[]> {
  console.log('Scraping goodreturns.in and TradingEconomics for Live Commodities...');
  const results: RawData[] = [];
  const USD_INR = 83.5;

  try {
    // 1. Scrape exact local Gold price from GoodReturns
    await page.goto('https://www.goodreturns.in/gold-rates/kerala.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const goldPriceMatch = await page.evaluate(() => {
      const allText = document.body.innerText;
      const match = allText.match(/(?:1 Gram|1 g|1g)[\s\S]{0,50}?([₹Rs\.]\s*[\d,]+)/i);
      return match ? match[1] : null;
    });
    if (goldPriceMatch) {
      const priceVal = parseFloat(goldPriceMatch.replace(/[^\d\.]/g, ''));
      // Gold is in INR/gram. Convert to MT -> * 1,000,000
      const mtPrice = priceVal * 1000000;
      results.push({
        component: 'Gold',
        priceStr: mtPrice.toString(),
        source: 'GoodReturns',
        city: 'Kerala',
        url: 'https://www.goodreturns.in/gold-rates/kerala.html'
      });
    }

    // 2. Scrape exact local Silver price from GoodReturns
    await page.goto('https://www.goodreturns.in/silver-rates/kerala.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const silverPriceMatch = await page.evaluate(() => {
      const allText = document.body.innerText;
      const match = allText.match(/Silver[\s\S]{1,20}?([₹Rs\.]\s*[\d,]+)\/kg/i);
      return match ? match[1] : null;
    });
    if (silverPriceMatch) {
      // Silver is in INR/kg. Convert to MT -> * 1,000
      const priceVal = parseFloat(silverPriceMatch.replace(/[^\d\.]/g, ''));
      const mtPrice = priceVal * 1000;
      results.push({
        component: 'Silver',
        priceStr: mtPrice.toString(),
        source: 'GoodReturns',
        city: 'Kerala',
        url: 'https://www.goodreturns.in/silver-rates/kerala.html'
      });
    }

    // 3. Fallback to TradingEconomics for industrial/agricultural
    await page.goto('https://tradingeconomics.com/commodities', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const commodities = await page.evaluate(() => {
      const data: any[] = [];
      const rows = document.querySelectorAll('table tr');
      rows.forEach(row => {
        const nameEl = row.querySelector('td:nth-child(1)');
        const priceEl = row.querySelector('td:nth-child(2)');
        if (nameEl && priceEl && nameEl.textContent.trim()) {
          data.push({
            name: nameEl.textContent.replace(/\s+/g, ' ').trim(),
            price: parseFloat(priceEl.textContent.replace(/,/g, '').trim())
          });
        }
      });
      return data;
    });

    for (const item of commodities) {
      let priceMT = 0;
      const nameLower = item.name.toLowerCase();
      
      // Skip Gold/Silver as we fetched them from GoodReturns
      if (nameLower.includes('gold') || nameLower.includes('silver')) continue;

      if (nameLower.includes('palladium')) {
        priceMT = (item.price * USD_INR) / 0.0000311035;
      } else if (nameLower.includes('wheat') || nameLower.includes('corn')) {
        priceMT = ((item.price / 100) * USD_INR) / 0.0272155;
      } else if (nameLower.includes('rice')) {
        priceMT = (item.price * USD_INR) / 0.0453592;
      } else if (nameLower.includes('crude oil') || nameLower.includes('brent')) {
        priceMT = (item.price * USD_INR) / 0.136;
      } else if (nameLower.includes('coal') || nameLower.includes('aluminum') || nameLower.includes('zinc') || nameLower.includes('lead') || nameLower.includes('copper')) {
        priceMT = item.price * USD_INR;
      }

      if (priceMT > 0) {
        results.push({
          component: item.name.split(' ')[0], 
          priceStr: priceMT.toString(), 
          source: 'TradingEconomics',
          city: 'Global',
          url: 'https://tradingeconomics.com/commodities'
        });
      }
    }

  } catch (err: any) {
    console.warn(`[Scraping] Failed to scrape global markets: ${err.message}`);
  }

  return results;
}

async function runScraper() {
  console.log('Scraping session started. Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    const rawData: RawData[] = [];
    
    // 1. Scrape Salasar
    console.log('Skipping interactive Salasar for now to allow automated background scraping...');
    // const salasarData = await scrapeSalasar(browser);
    // rawData.push(...salasarData);

    // 2. Scrape Markets
    console.log('Scraping ScrapRates...');
    rawData.push(...(await scrapeScrapRates(page)));
    console.log('Scraping RecycleInMe...');
    rawData.push(...(await scrapeRecycleInMe(page)));
    console.log('Scraping IndiaMart...');
    rawData.push(...(await scrapeIndiaMart(page)));
    console.log('Scraping Global Commodities...');
    rawData.push(...(await scrapeGlobalCommodities(page)));

    console.log(`Extracted total ${rawData.length} raw price points.`);

    const parsedData: ParsedData[] = rawData.map(item => ({
      ...item,
      normalizedComponent: normalizeComponent(item.component),
      parsedPriceMT: parsePriceToMT(item.priceStr, item.source) || 0
    })).filter(item => item.normalizedComponent.length > 0 && (item.parsedPriceMT > 0 || item.source.includes('Salasar')));

    // Build Flat Summary (Backward Compatible)
    const grouped = new Map<string, { total: number; count: number; rawEntries: any[]; hasSalasar: boolean }>();

    for (const item of parsedData) {
      const key = item.normalizedComponent;
      if (!grouped.has(key)) {
        grouped.set(key, { total: 0, count: 0, rawEntries: [], hasSalasar: false });
      }
      const group = grouped.get(key)!;
      if (item.parsedPriceMT > 0) {
        group.total += item.parsedPriceMT;
        group.count += 1;
      }
      if (item.source.includes('Salasar')) {
        group.hasSalasar = true;
      }
      group.rawEntries.push({
        city: item.city || 'N/A',
        source: item.source,
        originalName: item.normalizedComponent,
        priceMT: item.parsedPriceMT,
        priceStr: item.priceStr,
        url: item.url
      });
    }

    // Build Hierarchical Category/Subcategory averages
    const categoriesMap = new Map<string, { total: number; count: number; subcategoriesSet: Set<string> }>();
    const subcategoriesMap = new Map<string, { total: number; count: number; parentCategory: string; entries: ScrapedProductEntry[] }>();

    for (const item of parsedData) {
      const priceMT = item.parsedPriceMT;
      const { category, subcategory } = classifyItem(item.component, item.url || '', item.source);

      // Add to subcategory
      if (!subcategoriesMap.has(subcategory)) {
        subcategoriesMap.set(subcategory, { total: 0, count: 0, parentCategory: category, entries: [] });
      }
      const subG = subcategoriesMap.get(subcategory)!;
      if (priceMT > 0) {
        subG.total += priceMT;
        subG.count++;
      }
      subG.entries.push({
        originalName: item.normalizedComponent,
        source: item.source,
        city: item.city || 'N/A',
        priceMT: priceMT,
        priceStr: item.priceStr,
        url: item.url
      });

      // Add to category
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, { total: 0, count: 0, subcategoriesSet: new Set<string>() });
      }
      const catG = categoriesMap.get(category)!;
      if (priceMT > 0) {
        catG.total += priceMT;
        catG.count++;
      }
      catG.subcategoriesSet.add(subcategory);
    }

    // Convert category/subcategory mappings to final outputs
    const categoriesOutput: Record<string, CategoryGroup> = {};
    for (const [catName, value] of categoriesMap.entries()) {
      let sumSubAvg = 0;
      let countSub = 0;
      for (const sub of value.subcategoriesSet) {
        const subObj = subcategoriesMap.get(sub);
        if (subObj && subObj.count > 0) {
          sumSubAvg += (subObj.total / subObj.count);
          countSub++;
        }
      }
      const avg = countSub > 0 ? sumSubAvg / countSub : 0;
      categoriesOutput[catName] = {
        averagePriceMT: avg.toFixed(2),
        sourcesAveraged: value.count,
        subcategories: Array.from(value.subcategoriesSet)
      };
    }

    const subcategoriesOutput: Record<string, SubcategoryGroup> = {};
    for (const [subName, value] of subcategoriesMap.entries()) {
      const avg = value.count > 0 ? value.total / value.count : 0;
      subcategoriesOutput[subName] = {
        averagePriceMT: avg.toFixed(2),
        sourcesAveraged: value.count,
        parentCategory: value.parentCategory,
        entries: value.entries
      };
    }

    const finalReport = {
      timestamp: new Date().toISOString(),
      summary: {} as Record<string, { averagePriceMT: string; sourcesAveraged: number; hasSalasar: boolean; entries: any[] }>,
      categories: categoriesOutput,
      subcategories: subcategoriesOutput
    };

    let newComponents = 0;
    let updatedComponents = 0;

    const sortedKeys = Array.from(grouped.keys()).sort();
    for (const key of sortedKeys) {
      const group = grouped.get(key)!;
      const average = group.count > 0 ? group.total / group.count : 0;
      finalReport.summary[key] = {
        averagePriceMT: average.toFixed(2),
        sourcesAveraged: group.count,
        hasSalasar: group.hasSalasar,
        entries: group.rawEntries
      };
      if (group.hasSalasar) {
         updatedComponents++;
      }
    }

    const outputPath = path.join(process.cwd(), 'daily_market_prices.json');
    
    const auditFile = path.join(process.cwd(), 'scraper_audit.json');
    let auditLogs: any[] = [];
    if (fs.existsSync(auditFile)) {
      auditLogs = JSON.parse(fs.readFileSync(auditFile, 'utf-8'));
    }

    const logToAudit = (type: string, component: string, oldVal: string, newVal: string) => {
       auditLogs.push({
         timestamp: new Date().toISOString(),
         type,
         component,
         oldPriceMT: oldVal,
         newPriceMT: newVal
       });
    };

    // Check if new components added by reading old file
    if (fs.existsSync(outputPath)) {
      const oldData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      for (const key of sortedKeys) {
        const newVal = finalReport.summary[key].averagePriceMT;
        if (!oldData.summary || !oldData.summary[key]) {
          newComponents++;
          console.log(`[ADDED] ${key.toUpperCase()} - MT Price: ₹${newVal}`);
          logToAudit('ADDED', key.toUpperCase(), '0', newVal);
        } else {
          const oldVal = oldData.summary[key].averagePriceMT;
          if (oldVal !== newVal) {
            console.log(`[UPDATED] ${key.toUpperCase()} changed from ₹${oldVal} to ₹${newVal}`);
            logToAudit('UPDATED', key.toUpperCase(), oldVal, newVal);
          } else {
            console.log(`[VERIFIED] ${key.toUpperCase()} - MT Price: ₹${newVal} (No Change)`);
          }
        }
      }
    } else {
      newComponents = sortedKeys.length;
      for (const key of sortedKeys) {
         const newVal = finalReport.summary[key].averagePriceMT;
         console.log(`[ADDED] ${key.toUpperCase()} - MT Price: ₹${newVal}`);
         logToAudit('ADDED', key.toUpperCase(), '0', newVal);
      }
    }

    fs.writeFileSync(auditFile, JSON.stringify(auditLogs, null, 2), 'utf-8');
    fs.writeFileSync(outputPath, JSON.stringify(finalReport, null, 2), 'utf-8');

    console.log(`Scraping finished! Added ${newComponents} new components. Updated ${sortedKeys.length} total components (represented in MT).`);
    console.log(`Saved output to: ${outputPath}`);

  } catch (error: any) {
    console.log(`Fatal error during scraping: ${error.message}`);
  } finally {
    await browser.close();
  }
}

runScraper();
