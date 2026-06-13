import fetch from 'node-fetch';
import * as fs from 'fs';

async function fetchReport() {
  const aucId = '581850';
  const url = `https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report.jsp`;
  
  // Set up cookies
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded'
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

  const formData = new URLSearchParams();
  formData.append('auc', aucId);
  formData.append('cat', '0');
  formData.append('sell', '0');

  console.log(`POSTing to detailed report page HTML: ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers
  });
  
  if (!res.ok) {
    console.error(`Failed to fetch report HTML: status ${res.status}`);
    return;
  }

  const html = await res.text();
  console.log(`Downloaded ${html.length} characters of HTML.`);
  fs.writeFileSync('detailed_report.html', html, 'utf-8');

  // Let's search for "Annex_" or "Photo_" or ".pdf"
  let index = 0;
  let matches = 0;
  
  const term = '55081'; // Part of the filename
  while ((index = html.indexOf(term, index)) !== -1) {
    matches++;
    const snippet = html.substring(Math.max(0, index - 250), Math.min(html.length, index + 350));
    console.log(`\n--- Match ${matches} at position ${index} ---`);
    console.log(snippet);
    index += term.length;
  }
  
  if (matches === 0) {
    console.log(`No matches found for term "${term}". Searching generally for ".pdf"...`);
    let pdfIdx = 0;
    let pdfMatches = 0;
    while ((pdfIdx = html.indexOf('.pdf', pdfIdx)) !== -1) {
      pdfMatches++;
      const snippet = html.substring(Math.max(0, pdfIdx - 200), Math.min(html.length, pdfIdx + 300));
      console.log(`\n--- PDF Match ${pdfMatches} at position ${pdfIdx} ---`);
      console.log(snippet);
      pdfIdx += 4;
      if (pdfMatches >= 15) break;
    }
  }
}

fetchReport().catch(console.error);
