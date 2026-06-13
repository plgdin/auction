import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function parseMstcCatalogText(text: string, categoryName: string, sellerName: string, location: string): any {
  const lines = text.split('\n').map(l => l.trim());
  const cleanText = lines.join('\n');

  let emdValue = '10% of total bid value';
  let preBidDdg = 'Not required for registered MSME bidders';

  // 1. EMD & Pre-Bid Percentage
  const emdPercentMatch = cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*\n*([\d\.]+)/i) || cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*([\d\.]+)/i);
  if (emdPercentMatch) {
    emdValue = `${emdPercentMatch[1]}% of total bid value (Post-Bid EMD)`;
  } else {
    const preBidMatch = cleanText.match(/Pre-Bid EMD:\s*([^\n]+)/);
    if (preBidMatch) {
      const matchVal = preBidMatch[1].trim();
      if (!matchVal.toLowerCase().includes('not a auto') && !matchVal.toLowerCase().includes('item wise')) {
        const numOnly = matchVal.replace(/[^\d]/g, '');
        if (numOnly && parseInt(numOnly, 10) > 100) {
          preBidDdg = `₹${parseInt(numOnly, 10).toLocaleString('en-IN')}`;
          emdValue = '10% of total bid value';
        } else {
          emdValue = matchVal;
        }
      }
    }
  }

  // 2. Explicit Pre-Bid Amount
  const explicitPreBidMatch = cleanText.match(/(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]{4,10})/i);
  if (explicitPreBidMatch) {
    const val = explicitPreBidMatch[1].replace(/,/g, '');
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 100) {
      preBidDdg = `₹${num.toLocaleString('en-IN')}`;
    }
  }

  // 3. Contacts
  let contactName = '';
  let contactEmail = '';
  let contactPhone = '';
  const contactMatch = cleanText.match(/Contact Person:\s*([^\n]+)/);
  if (contactMatch) contactName = contactMatch[1].trim();
  const emailMatch = cleanText.match(/e-Mail\s*:\s*([^\n]+)/i) || cleanText.match(/Seller Email Address\s*([^\n]+)/i);
  if (emailMatch) contactEmail = emailMatch[1].trim();
  const phoneMatch = cleanText.match(/Mobile\s*:\s*(\d+)/i) || cleanText.match(/Telephone Number\s*(\d+)/i);
  if (phoneMatch) contactPhone = phoneMatch[1].trim();

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

  const officerOneName = cleanText.match(/Officer OneName:\s*([^\n]+)/) || cleanText.match(/Officer OneName\s*([^\n]+)/);
  const keyContacts = [
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

  // 4. Lots
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
      if (nameMatch) lotName = nameMatch[1].replace(/\r?\n/g, ' ').trim();

      let qty = '1';
      let unit = 'Lot';
      const qtyMatch = block.match(/Quantity\s*-\s*([\d\.,]+)\s*([A-Za-z]+)?/i);
      if (qtyMatch) {
        qty = qtyMatch[1].trim();
        unit = (qtyMatch[2] || 'Lot').trim();
      }

      let gst = 'As Applicable';
      const gstMatch = block.match(/GST\s*\(%\)\s*-\s*([\s\S]*?)(?=Lot Location|State|Lot State|TCS|Bid Valid|$)/i);
      if (gstMatch) gst = gstMatch[1].replace(/\r?\n/g, ' ').trim();

      let tcs = '0.0';
      const tcsMatch = block.match(/TCS\s*\(%\)\s*-\s*([\s\S]*?)(?=GST|Lot Location|State|Lot State|Bid Valid|$)/i);
      if (tcsMatch) tcs = tcsMatch[1].replace(/\r?\n/g, ' ').trim();

      items.push({
        sr: lotNo,
        description: lotName || categoryName,
        qty,
        unit,
        taxRate: `${gst} GST${tcs && tcs !== '0.0' && tcs !== '0' ? ' + ' + tcs + '% TCS' : ''}`
      });
    }
  }

  if (items.length === 0) {
    items.push({ sr: 1, description: categoryName, qty: '1.0', unit: 'LOT', taxRate: 'As Applicable GST' });
  }

  const itemNames = items.map(it => it.description.toLowerCase()).join(', ');
  const overview = `This auction is conducted by MSTC on behalf of ${sellerName} for the disposal of ${itemNames} located at ${location || 'designated site areas'}.`;
  const scopeOfWork = `Lifting, clearing, and disposal of designated lots of ${itemNames} in accordance with MSTC Special Terms & Conditions (STC). All items are sold on an "As-Is-Where-Is" basis.`;

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
      preBidDdg,
      adminCharges: '₹11,800 (incl. GST) non-refundable service provider fees'
    },
    keyContacts
  };
}

async function renderPdfFirstPage(fileBuffer: Buffer): Promise<Buffer | null> {
  let browser = null;
  try {
    const pdfBase64 = fileBuffer.toString('base64');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1448 });
    const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
    await page.goto(dataUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    const imageBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    return imageBuffer as Buffer;
  } catch (err: any) {
    console.error('[Backfill PDF Render Error]:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function executeBackfill(task: 'parse' | 'images' | 'both') {
  console.log(`Starting backfill operation (mode: ${task.toUpperCase()})...`);
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, raw_materials_text, category_name, seller_name, location, preview_image_path')
    .eq('asset_status', 'completed')
    .not('sanitized_document_path', 'is', null);

  if (error) {
    console.error('Failed to query completed records:', error.message);
    return;
  }

  console.log(`Found ${records?.length || 0} completed records to process.`);

  let index = 0;
  for (const record of records || []) {
    index++;
    try {
      console.log(`[${index}/${records.length}] Processing ${record.mstc_auction_number}...`);
      const res = await fetch(record.sanitized_document_path!);
      if (!res.ok) {
        console.warn(` - Skip (Download failed: ${res.statusText})`);
        continue;
      }
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
        console.warn(' - Skip (Downloaded buffer is not PDF)');
        continue;
      }

      const updates: any = {};

      if (task === 'parse' || task === 'both') {
        const parsedPdf = await pdf(buffer);
        if (parsedPdf?.text) {
          const summaryObj = parseMstcCatalogText(
            parsedPdf.text,
            record.category_name || '',
            record.seller_name || '',
            record.location || ''
          );
          updates.raw_materials_text = JSON.stringify(summaryObj);
        }
      }

      if (task === 'images' || task === 'both') {
        // Render preview image and upload it
        const imageBuffer = await renderPdfFirstPage(buffer);
        if (imageBuffer) {
          const sanitizedAuctionNum = record.mstc_auction_number.replace(/[\/\\:*?"<>|]/g, '_');
          const previewStoragePath = `mstc-previews/${sanitizedAuctionNum}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('auction_documents')
            .upload(previewStoragePath, imageBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.error(` - Error uploading preview image: ${uploadError.message}`);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('auction_documents')
              .getPublicUrl(previewStoragePath);
            updates.preview_image_path = publicUrlData.publicUrl;
            console.log(` - Uploaded preview image: ${publicUrlData.publicUrl}`);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('mstc_auctions')
          .update(updates)
          .eq('id', record.id);

        if (updateError) {
          console.error(` - Database update failed: ${updateError.message}`);
        } else {
          console.log(` - Successfully updated database row.`);
        }
      }
    } catch (err: any) {
      console.error(` - Fatal error processing row: ${err.message}`);
    }
  }
}

const taskArg = (process.argv[2] || 'both').toLowerCase() as 'parse' | 'images' | 'both';
if (!['parse', 'images', 'both'].includes(taskArg)) {
  console.log('Usage: npx tsx scratch/backfill.ts [parse|images|both]');
  process.exit(0);
}
executeBackfill(taskArg);
