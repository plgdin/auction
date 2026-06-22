import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function getGoodReturns() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto('https://www.goodreturns.in/gold-rates/kerala.html', { waitUntil: 'domcontentloaded' });
    
    const price = await page.evaluate(() => {
      // Find the specific div for 24K 1 Gram
      const divs = Array.from(document.querySelectorAll('div, span, td'));
      for (const div of divs) {
        const text = div.textContent || '';
        // Often it's written as "1 Gram" "₹ 7,450" etc
        if (text.includes('1 Gram') && text.includes('24K')) {
          return text.trim();
        }
      }
      
      const allText = document.body.innerText;
      const match = allText.match(/(?:1 Gram|1 g|1g)[\s\S]{0,50}?([₹Rs\.]\s*[\d,]+)/i);
      return match ? match[1] : allText.substring(0, 1000);
    });
    console.log(`Kerala 24K Gold 1g Price: ${price}`);
  } catch(err) {
    console.error(err);
  }

  await browser.close();
}

getGoodReturns();
