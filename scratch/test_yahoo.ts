import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function getLivePrices() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const symbols = [
    { name: 'Gold', symbol: 'GC=F' },
    { name: 'Silver', symbol: 'SI=F' },
    { name: 'Crude Oil', symbol: 'CL=F' },
    { name: 'Wheat', symbol: 'ZW=F' }
  ];

  const results = [];

  for (const s of symbols) {
    try {
      await page.goto(`https://finance.yahoo.com/quote/${s.symbol}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const price = await page.evaluate(() => {
        // Find fin-streamer with data-field="regularMarketPrice"
        const el = document.querySelector('fin-streamer[data-field="regularMarketPrice"]');
        return el ? el.textContent : null;
      });
      console.log(`${s.name}: ${price}`);
      results.push({ name: s.name, price: price });
    } catch(err) {
      console.error(`Failed ${s.name}: ${err.message}`);
    }
  }

  await browser.close();
}

getLivePrices().catch(console.error);
