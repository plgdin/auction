import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testScrape() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  await page.goto('https://tradingeconomics.com/commodities', { waitUntil: 'domcontentloaded' });
  
  const prices = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('table tr');
    rows.forEach(row => {
      const nameEl = row.querySelector('td:nth-child(1)');
      const priceEl = row.querySelector('td:nth-child(2)');
      if (nameEl && priceEl && nameEl.textContent.trim()) {
        results.push({
          name: nameEl.textContent.trim(),
          price: priceEl.textContent.trim()
        });
      }
    });
    return results;
  });

  console.log('TradingEconomics Prices:', prices);
  await browser.close();
}

testScrape().catch(console.error);
