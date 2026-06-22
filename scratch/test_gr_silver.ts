import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function getGoodReturns() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto('https://www.goodreturns.in/silver-rates/kerala.html', { waitUntil: 'domcontentloaded' });
    
    const price = await page.evaluate(() => {
      const allText = document.body.innerText;
      return allText.substring(0, 500);
    });
    console.log(`Text: ${price}`);
  } catch(err) {
    console.error(err);
  }

  await browser.close();
}

getGoodReturns();
