import { Browser, Page } from 'puppeteer';

export async function scrapeSalasar(browser: Browser): Promise<any[]> {
  console.log('[Salasar] Starting live auction scraper...');
  const page = await browser.newPage();
  
  // Set headers to prevent soft bans
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  });

  const extractedItems: any[] = [];

  try {
    // Navigate to scrap prices or main page
    await page.goto('https://salasarauction.com/scrap-price', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Attempt to extract scrap prices from tables or lists
    const prices = await page.evaluate(() => {
      const items: any[] = [];
      // Look for tables that might contain component pricing
      const rows = document.querySelectorAll('tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
          const name = cols[0].innerText.trim();
          const priceStr = cols[1].innerText.trim();
          if (name && priceStr && /\d/.test(priceStr)) {
            items.push({ name, priceStr });
          }
        }
      });
      return items;
    });

    for (const p of prices) {
      extractedItems.push({
        source: 'Salasar',
        component: p.name,
        rawPrice: p.priceStr
      });
    }

    if (extractedItems.length === 0) {
       console.log('[Salasar] No direct scrap prices found. Exploring live auctions for materials...');
       await page.goto('https://salasarauction.com/', { waitUntil: 'networkidle2' });
       
       const auctionMaterials = await page.evaluate(() => {
         const materials: string[] = [];
         // The user was looking for parent-materials links
         const links = document.querySelectorAll('a[href*="parent-materials"]');
         links.forEach(link => {
           const text = link.textContent?.trim();
           if (text) materials.push(text);
         });
         return materials;
       });

       for (const mat of auctionMaterials) {
         extractedItems.push({
           source: 'Salasar Live Auction',
           component: mat,
           rawPrice: '0' // Placeholder for live items without explicit market price
         });
       }
    }

    console.log(`[Salasar] Extracted ${extractedItems.length} components.`);
    return extractedItems;

  } catch (err) {
    console.error(`[Salasar] Scraper failed:`, err);
    return [];
  } finally {
    await page.close();
  }
}
