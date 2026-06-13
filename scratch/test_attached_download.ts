import fetch from 'node-fetch';
import * as fs from 'fs';

async function testDownload() {
  const url = 'https://www.mstcecommerce.com/auctionhome/mstc/admin/upload/downAttachedFiles.jsp?FILE_ID=Annex_6_55081_7931598.pdf&doc_type=attached_annex';
  
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

  console.log(`Downloading attachment from: ${url}`);
  const res = await fetch(url, { headers });
  
  const body = await res.buffer();
  const isPDF = body.toString('utf-8', 0, 4) === '%PDF';
  console.log(`Response Status: ${res.status}`);
  console.log(`Content-Type: ${res.headers.get('content-type')}`);
  console.log(`Is PDF: ${isPDF}`);
  console.log(`Size: ${body.length} bytes`);
  if (!isPDF) {
    console.log(`Preview: ${body.toString('utf-8', 0, 300)}`);
  } else {
    console.log('Successfully downloaded a valid PDF document!');
    fs.writeFileSync('scratch/downloaded_annex.pdf', body);
    console.log('Saved to scratch/downloaded_annex.pdf');
  }
}

testDownload().catch(console.error);
