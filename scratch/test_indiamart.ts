import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

async function test() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Navigating to IndiaMart metal-scrap...');
  try {
    await page.goto('https://dir.indiamart.com/impcat/metal-scrap.html', { waitUntil: 'networkidle2', timeout: 30000 });
    
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => ({
        text: a.textContent?.trim() || '',
        href: a.getAttribute('href') || ''
      })).filter(item => item.href.includes('/impcat/') || item.href.includes('/messages/'));
    });

    console.log(`Found ${links.length} potential links:`);
    console.log(JSON.stringify(links.slice(0, 50), null, 2));

    const outerHTML = await page.evaluate(() => {
      // Find category container
      const bodyText = document.body.innerText;
      return bodyText.substring(0, 1000);
    });
    console.log('Page Text snippet:', outerHTML);

  } catch (err: any) {
    console.error('Error during navigation:', err.message);
  } finally {
    await browser.close();
  }
}

test();
