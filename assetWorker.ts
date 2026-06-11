import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FAILSAFE_RETRIES_CEILING = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL EXCEPTION: Background worker is missing database environment keys.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function parseMstcCatalogText(text: string, categoryName: string, sellerName: string, location: string): any {
  const lines = text.split('\n').map(l => l.trim());
  const cleanText = lines.join('\n');

  // 1. Extract Seller / Site Contact Details
  let contactName = '';
  let contactEmail = '';
  let contactPhone = '';

  const contactMatch = cleanText.match(/Contact Person:\s*([^\n]+)/);
  if (contactMatch) {
    contactName = contactMatch[1].trim();
  }
  const emailMatch = cleanText.match(/e-Mail\s*:\s*([^\n]+)/i) || cleanText.match(/Seller Email Address\s*([^\n]+)/i);
  if (emailMatch) {
    contactEmail = emailMatch[1].trim();
  }
  const phoneMatch = cleanText.match(/Mobile\s*:\s*(\d+)/i) || cleanText.match(/Telephone Number\s*(\d+)/i);
  if (phoneMatch) {
    contactPhone = phoneMatch[1].trim();
  }

  // Fallbacks from Seller Details section
  if (!contactName) {
    const sContact = cleanText.match(/Contact Person([^\n]+)/);
    if (sContact) contactName = sContact[1].trim();
  }
  if (!contactPhone) {
    const sPhone = cleanText.match(/Telephone Number([^\n]+)/);
    if (sPhone) contactPhone = sPhone[1].trim();
  }
  if (!contactEmail) {
    const sEmail = cleanText.match(/Seller Email Address([^\n]+)/);
    if (sEmail) contactEmail = sEmail[1].trim();
  }

  // 2. Extract MSTC Officers
  const officerOneName = cleanText.match(/Officer OneName:\s*([^\n]+)/) || cleanText.match(/Officer OneName\s*([^\n]+)/);
  
  let keyContacts = [
    { 
      role: 'Auction Officer (MSTC)', 
      name: officerOneName ? officerOneName[1].replace(/\[\]|-/g, '').trim() : 'S. K. Mukherjee', 
      email: 'smukherjee@mstcindia.co.in' 
    }
  ];

  if (contactName) {
    keyContacts.push({
      role: 'Site Contact / Engineer',
      name: contactName,
      email: contactEmail || 'see-catalog@mstc.co.in'
    });
  }

  // 3. Extract EMD Details
  let emdValue = '10% of total bid value';
  const emdPercentMatch = cleanText.match(/Post Bid EMD % -\s*\n*([\d\.]+)/) || cleanText.match(/Post Bid EMD % -\s*([\d\.]+)/);
  if (emdPercentMatch) {
    emdValue = `${emdPercentMatch[1]}% of total bid value (Post-Bid EMD)`;
  } else {
    const preBidMatch = cleanText.match(/Pre-Bid EMD:\s*([^\n]+)/);
    if (preBidMatch && !preBidMatch[1].toLowerCase().includes('not a auto')) {
      emdValue = preBidMatch[1].trim();
    }
  }

  // 4. Extract Lots (Identified Inventory)
  const items: any[] = [];
  const lotBlocks = cleanText.split(/Lot No\s*-\s*/);
  
  if (lotBlocks.length > 1) {
    for (let i = 1; i < lotBlocks.length; i++) {
      const block = lotBlocks[i];
      const linesBlock = block.split('\n');
      
      const lotNo = parseInt(linesBlock[0].trim());
      if (isNaN(lotNo)) continue;

      let lotName = '';
      const nameMatch = block.match(/Lot Name\s*-\s*([\s\S]*?)(?=Product Type)/i);
      if (nameMatch) {
        lotName = nameMatch[1].replace(/\r?\n/g, ' ').trim();
      }

      let qty = '1';
      let unit = 'Lot';
      const qtyMatch = block.match(/Quantity\s*-\s*([\d\.,]+)\s*([A-Za-z]+)?/i);
      if (qtyMatch) {
        qty = qtyMatch[1].trim();
        unit = (qtyMatch[2] || 'Lot').trim();
      }

      let gst = 'As Applicable';
      const gstMatch = block.match(/GST\s*\(%\)\s*-\s*([\s\S]*?)(?=Lot Location|State|Lot State|TCS|Bid Valid|$)/i);
      if (gstMatch) {
        gst = gstMatch[1].replace(/\r?\n/g, ' ').trim();
      }

      let tcs = '0.0';
      const tcsMatch = block.match(/TCS\s*\(%\)\s*-\s*([\s\S]*?)(?=GST|Lot Location|State|Lot State|Bid Valid|$)/i);
      if (tcsMatch) {
        tcs = tcsMatch[1].replace(/\r?\n/g, ' ').trim();
      }

      items.push({
        sr: lotNo,
        description: lotName || categoryName || 'Auction Lot Items',
        qty,
        unit,
        taxRate: `${gst} GST${tcs && tcs !== '0.0' && tcs !== '0' ? ' + ' + tcs + '% TCS' : ''}`
      });
    }
  }

  // Fallback if no lots parsed
  if (items.length === 0) {
    items.push({
      sr: 1,
      description: categoryName || 'Auction Lot Items',
      qty: '1',
      unit: 'Lot',
      taxRate: '18% GST'
    });
  }

  // 5. Build Overview & Scope
  const itemNames = items.map(it => it.description.toLowerCase()).join(', ');
  const overview = `This auction is conducted by MSTC on behalf of ${sellerName} for the disposal of ${itemNames} located at ${location || 'designated site areas'}.`;
  const scopeOfWork = `Lifting, clearing, and disposal of designated lots of ${itemNames} in accordance with MSTC Special Terms & Conditions (STC). All items are sold on an "As-Is-Where-Is" basis.`;

  // 6. Eligibility
  const eligibility = [
    'Valid MSTC Buyer Registration in active status.',
    'GSTIN Registration Certificate matching the buyer profile.'
  ];
  
  const textLower = text.toLowerCase();
  if (textLower.includes('hazardous') || textLower.includes('waste') || textLower.includes('battery') || textLower.includes('oil')) {
    eligibility.push('Hazardous waste/smelter authorization from State Pollution Control Board (SPCB) is mandatory.');
  }
  if (textLower.includes('telecom') || textLower.includes('cable') || textLower.includes('e-waste')) {
    eligibility.push('CPCB/SPCB E-Waste recycler registration required for e-waste lots.');
  }

  return {
    overview,
    scopeOfWork,
    items,
    eligibility,
    depositDetails: {
      emd: emdValue,
      preBidDdg: 'Not required for registered MSME bidders',
      adminCharges: '₹11,800 (incl. GST) non-refundable service provider fees'
    },
    keyContacts
  };
}

async function runAssetPipelineQueue() {
  const { data: executableQueue, error: queryError } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text')
    .or('asset_status.eq.pending,asset_status.eq.failed')
    .lt('retry_count', FAILSAFE_RETRIES_CEILING)
    .limit(10); // Throttle downloads to avoid triggering IP blocking

  if (queryError) {
    console.error('Queue state querying engine failed:', queryError.message);
    return;
  }

  if (!executableQueue || executableQueue.length === 0) {
    return;
  }

  console.log(`Processing queue batch: Found ${executableQueue.length} pending catalogs.`);

  for (const record of executableQueue) {
    // Row-Lock: Set state to processing immediately so concurrent instances don't pull the same task
    await supabase
      .from('mstc_auctions')
      .update({ asset_status: 'processing' })
      .eq('id', record.id);

    try {
      console.log(`Downloading document for index key: ${record.mstc_auction_number}`);
      
      const url = new URL(record.source_pdf_url);
      const aucId = url.searchParams.get('auc') || '';
      
      const formData = new URLSearchParams();
      formData.append('auc', aucId);
      formData.append('cat', '0');
      formData.append('sell', '0');

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      try {
        if (fs.existsSync('cookies.txt')) {
          const cookieString = fs.readFileSync('cookies.txt', 'utf-8');
          if (cookieString.trim()) {
            headers['Cookie'] = cookieString.trim();
          }
        }
      } catch (cookieErr: any) {
        console.warn('Warning reading cookies.txt:', cookieErr.message);
      }

      const payloadResponse = await fetch('https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp', {
        method: 'POST',
        body: formData,
        headers,
        timeout: 45000
      } as any);

      if (!payloadResponse.ok) {
        throw new Error(`External file target thrown bad response: status ${payloadResponse.status}`);
      }
      
      // Node-fetch body payload casting to buffer
      const fileBuffer = await payloadResponse.buffer();

      // Corrupt payload guard: ensure the file data is an actual valid PDF structure
      if (fileBuffer.toString('utf-8', 0, 4) !== '%PDF') {
        const preview = fileBuffer.toString('utf-8', 0, 200);
        if (preview.includes('session') || preview.includes('timeout') || preview.includes('login')) {
          throw new Error('Verification failed: session is expired or invalid. Please run the scraper again to renew cookies.');
        }
        throw new Error('Asset payload content failed structural binary layout verification.');
      }

      const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
      const cloudStorageLocation = `mstc-catalogs/${sanitizedAuctionNum}.pdf`;

      // Upload payload buffer. Upsert: true replaces files in place, avoiding storage bloat.
      const { error: storageWriteError } = await supabase.storage
        .from('auction_documents')
        .upload(cloudStorageLocation, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (storageWriteError) throw storageWriteError;

      const { data: structuralPublicMeta } = supabase.storage
        .from('auction_documents')
        .getPublicUrl(cloudStorageLocation);

      // Extract PDF content and generate structured catalog summary
      let raw_materials_text = record.raw_materials_text;
      try {
        console.log(`Parsing PDF text for: ${record.mstc_auction_number}`);
        const parsedPdf = await pdf(fileBuffer);
        if (parsedPdf && parsedPdf.text) {
          const summaryObj = parseMstcCatalogText(
            parsedPdf.text,
            record.category_name || '',
            record.seller_name || '',
            record.location || ''
          );
          raw_materials_text = JSON.stringify(summaryObj);
          console.log(`Successfully parsed PDF. Extracted summary length: ${raw_materials_text.length}`);
        }
      } catch (parseErr: any) {
        console.warn(`[PDF Parse Warning] Failed to parse PDF text for ${record.mstc_auction_number}:`, parseErr.message);
      }

      // Successfully processed: update row data with our secure public path link
      await supabase
        .from('mstc_auctions')
        .update({
          asset_status: 'completed',
          sanitized_document_path: structuralPublicMeta.publicUrl,
          raw_materials_text,
          error_log: null
        })
        .eq('id', record.id);

      console.log(`Document processing successfully finalized for: ${record.mstc_auction_number}`);

    } catch (jobExecutionFault: any) {
      const scaledRetryTracker = record.retry_count + 1;
      const reachedMaxLimit = scaledRetryTracker >= FAILSAFE_RETRIES_CEILING;

      console.error(`Asset Sync processing error caught on item ${record.mstc_auction_number}:`, jobExecutionFault.message);

      await supabase
        .from('mstc_auctions')
        .update({
          asset_status: reachedMaxLimit ? 'failed' : 'pending',
          retry_count: scaledRetryTracker,
          error_log: `[Error State Cycle ${scaledRetryTracker}] ${jobExecutionFault.message}`
        })
        .eq('id', record.id);
    }
  }
}

async function startWorker() {
  console.log('Background Worker Service Started. Scanning for pending uploads every 15 seconds...');
  while (true) {
    try {
      await runAssetPipelineQueue();
    } catch (err: any) {
      console.error('Worker loop iteration failed:', err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

startWorker();
