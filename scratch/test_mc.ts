import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testScrape() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.moneycontrol.com/commodity/', { waitUntil: 'domcontentloaded' });
  
  const prices = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('table.mctable1 tbody tr');
    rows.forEach(row => {
      const nameEl = row.querySelector('td:nth-child(1) a');
      const priceEl = row.querySelector('td:nth-child(2)');
      if (nameEl && priceEl) {
        results.push({
          name: nameEl.textContent.trim(),
          price: priceEl.textContent.trim()
        });
      }
    });
    return results;
  });

  console.log('MoneyControl Prices:', prices);
  await browser.close();
}

testScrape().catch(console.error);
