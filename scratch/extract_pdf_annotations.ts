import fetch from 'node-fetch';
import * as fs from 'fs';

async function extractAnnotations() {
  const catalogUrl = 'https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/mstc-catalogs/MSTC_PTN_BIHAR%20MILITARY%20POLICE%20(9)_1_NEAR%20TVS%20SHOWROOM,%20JAMALPUR_26-27_11307.pdf';
  console.log(`Downloading PDF catalog from: ${catalogUrl}`);
  const res = await fetch(catalogUrl);
  const pdfBuffer = await res.buffer();
  
  console.log(`Downloaded ${pdfBuffer.length} bytes.`);

  // Let's scan the PDF buffer for "/URI" tags
  let pos = 0;
  let matches = 0;
  while (pos < pdfBuffer.length) {
    const idx = pdfBuffer.indexOf('/URI', pos);
    if (idx === -1) break;
    
    matches++;
    const snippet = pdfBuffer.slice(Math.max(0, idx - 100), Math.min(pdfBuffer.length, idx + 200)).toString('ascii');
    console.log(`\nMatch ${matches} at position ${idx}:`);
    console.log(snippet);
    pos = idx + 4;
  }
  
  if (matches === 0) {
    console.log('No direct /URI matches found in raw PDF binary.');
  }
}

extractAnnotations().catch(console.error);
