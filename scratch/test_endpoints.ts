import fetch from 'node-fetch';
import * as fs from 'fs';

async function testEndpoints() {
  const fileName = 'Annex_6_55081_7931598.pdf';
  
  // Potential endpoints
  const paths = [
    'https://www.mstcecommerce.com/auctionhome/RenderFileGeneralAuctions.jsp',
    'https://www.mstcecommerce.com/auctionhome/mstc/RenderFileGeneralAuctions.jsp',
    'https://www.mstcecommerce.com/auctionhome/mstc/renderFile.jsp',
    'https://www.mstcecommerce.com/auctionhome/mstc/RenderFile.jsp',
    'https://www.mstcecommerce.com/auctionhome/aucsearch/renderFile.jsp',
    'https://www.mstcecommerce.com/auctionhome/aucsearch/RenderFile.jsp',
    'https://www.mstcecommerce.com/auctionhome/mstc/RenderFileGeneral.jsp',
    'https://www.mstcecommerce.com/auctionhome/RenderFileGeneral.jsp',
    'https://www.mstcecommerce.com/auctionhome/RenderFile.jsp',
    'https://www.mstcecommerce.com/auctionhome/renderFile.jsp',
  ];

  // Set up cookies
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  };
  try {
    if (fs.existsSync('cookies.txt')) {
      const cookieString = fs.readFileSync('cookies.txt', 'utf-8');
      if (cookieString.trim()) {
        headers['Cookie'] = cookieString.trim();
        console.log('Loaded cookies from cookies.txt');
      }
    }
  } catch (e) {}

  for (const basePath of paths) {
    const url = `${basePath}?file=${fileName}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const body = await res.buffer();
      const isPDF = body.toString('utf-8', 0, 4) === '%PDF';
      const bodyPreview = body.toString('utf-8', 0, 100).trim().replace(/\r?\n/g, ' ');
      
      console.log(`\nURL: ${url}`);
      console.log(`Status: ${res.status} | Content-Type: ${res.headers.get('content-type')}`);
      console.log(`Is PDF: ${isPDF} | Size: ${body.length} bytes`);
      console.log(`Preview: ${bodyPreview}`);
    } catch (err: any) {
      console.error(`Error fetching ${url}:`, err.message);
    }
  }
}

testEndpoints().catch(err => console.error(err));
