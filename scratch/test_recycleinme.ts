import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function test() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Navigating to RecycleInMe...');
  try {
    await page.goto('https://www.recycleinme.com/scrappricelisting/Indian%20Scrap%20Prices', { waitUntil: 'networkidle2', timeout: 30000 });
    
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => ({
        text: a.textContent?.trim() || '',
        href: a.getAttribute('href') || ''
      })).filter(item => 
        item.href.includes('pricelisting') || 
        item.href.includes('pricedetailedlisting') || 
        item.href.includes('scrap_prices') ||
        item.href.includes('metal_prices') ||
        item.href.includes('plastic_prices')
      );
    });

    console.log(`Found ${links.length} potential links:`);
    console.log(JSON.stringify(links.slice(0, 50), null, 2));

  } catch (err: any) {
    console.error('Error during navigation:', err.message);
  } finally {
    await browser.close();
  }
}

test();
