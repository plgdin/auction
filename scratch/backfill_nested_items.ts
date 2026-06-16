import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  const phoneMatch = cleanText.match(/Mobile\s*:\s*([^\n]+)/i) || cleanText.match(/Telephone Number\s*([^\n]+)/i);
  if (phoneMatch) contactPhone = phoneMatch[1].replace(/^[:\s]+/, "").trim();

  if (!contactName) {
    const sContact = cleanText.match(/Contact Person([^\n]+)/);
    if (sContact) contactName = sContact[1].trim();
  }
  if (!contactPhone) {
    const sPhone = cleanText.match(/Telephone Number([^\n]+)/);
    if (sPhone) contactPhone = sPhone[1].replace(/^[:\s]+/, "").trim();
  }
  if (!contactEmail) {
    const sEmail = cleanText.match(/Seller Email Address([^\n]+)/);
    if (sEmail) contactEmail = sEmail[1].trim();
  }

  let officerName = "no contact info available";
  let officerEmail = "no contact info available";
  let officerPhone = "no contact info available";
  const docLines = cleanText.split('\n');
  const officerIdx = docLines.findIndex(l => l.includes("Officer OneName:"));
  if (officerIdx !== -1) {
    const nameLine = docLines[officerIdx].replace(/Name\s*&\s*Designation\s*of\s*Officer\s*OneName:\s*/i, "").trim();
    if (nameLine && !nameLine.toLowerCase().includes("email:") && !nameLine.toLowerCase().includes("phone:")) {
      officerName = nameLine.replace(/[\[\{\(]\s*[-_.\s]*\s*[\]\}\)]/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    }
    for (let i = officerIdx + 1; i < Math.min(officerIdx + 5, docLines.length); i++) {
      const line = docLines[i];
      if (line.includes("Officer TwoName:")) break;
      const emailMatch = line.match(/^Email\s*:?\s*([^\n]*)/i);
      if (emailMatch) {
        const val = emailMatch[1].replace(/^[:\s]+/, "").trim();
        if (val) officerEmail = val;
      }
      const phoneMatch = line.match(/^Phone\s*:?\s*([^\n]*)/i);
      if (phoneMatch) {
        const val = phoneMatch[1].replace(/^[:\s]+/, "").trim();
        if (val) officerPhone = val;
      }
    }
  }

  const keyContacts = [
    {
      role: 'Auction Officer (MSTC)',
      name: officerName || 'no contact info available',
      email: officerEmail || 'no contact info available',
      phone: officerPhone || 'no contact info available'
    }
  ];

  if (contactName) {
    const cleanContactName = contactName.replace(/[\[\{\(]\s*[-_.\s]*\s*[\]\}\)]/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    keyContacts.push({
      role: 'Site Contact / Engineer',
      name: cleanContactName,
      email: contactEmail || 'see-catalog@mstc.co.in',
      phone: contactPhone || 'no contact info available'
    });
  }

  // 4. Lots (with sub-item extraction)
  const items: any[] = [];
  const lotBlocks = cleanText.split(/Lot No\s*-\s*/);
  let hasSubItemsExtracted = false;

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

      const taxRate = `${gst} GST${tcs && tcs !== '0.0' && tcs !== '0' ? ' + ' + tcs + '% TCS' : ''}`;

      // Search for sub-items
      const subItems: any[] = [];
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (let j = 0; j < blockLines.length; j++) {
        const line = blockLines[j];
        if (line.toLowerCase().startsWith('quantity -')) continue;

        let subQty = '';
        let subUnit = '';
        
        const directMatch = line.match(/(?:QTY|Quantity)\s*[:\-]\s*([\d,.]+)\s*([A-Za-z]+)?/i);
        if (directMatch) {
          subQty = directMatch[1];
          subUnit = directMatch[2] || '';
        } else if (/^(?:QTY|Quantity)\s*[:\-]?$/i.test(line) && j + 1 < blockLines.length) {
          const nextLine = blockLines[j + 1];
          const nextMatch = nextLine.match(/^([\d,.]+)\s*([A-Za-z]+)?/i);
          if (nextMatch) {
            subQty = nextMatch[1];
            subUnit = nextMatch[2] || '';
          }
        }

        if (subQty) {
          // Find description by looking upwards
          let desc = '';
          for (let k = j - 1; k >= 0; k--) {
            const prevLine = blockLines[k];
            if (
              prevLine.includes('Lot No -') ||
              prevLine.includes('Lot Name -') ||
              prevLine.includes('Product Type -') ||
              prevLine.includes('Category -') ||
              prevLine.toLowerCase().startsWith('qty') ||
              prevLine.toLowerCase().includes('(approx') ||
              prevLine === '(approx.)'
            ) {
              break;
            }
            
            const cleanPrev = prevLine.trim();
            if (desc === '') {
              desc = cleanPrev;
            } else {
              desc = cleanPrev + ' ' + desc;
            }
            
            if (
              cleanPrev.toLowerCase().includes('poly bag') ||
              cleanPrev.toLowerCase().includes('rags') ||
              cleanPrev.toLowerCase().includes('cfc') ||
              cleanPrev.toLowerCase().includes('tin') ||
              cleanPrev.toLowerCase().includes('brl') ||
              cleanPrev.toLowerCase().includes('jerrican') ||
              cleanPrev.toLowerCase().includes('grease drum') ||
              cleanPrev.toLowerCase().includes('iron scrap') ||
              cleanPrev.toLowerCase().includes('bag 1 md') ||
              cleanPrev.length > 15
            ) {
              break;
            }
          }
          
          if (desc) {
            subItems.push({
              sr: lotNo,
              description: desc.trim(),
              qty: subQty.replace(/,/g, ''),
              unit: subUnit.trim() || 'Nos',
              taxRate
            });
          }
        }
      }

      if (subItems.length > 0) {
        items.push(...subItems);
        hasSubItemsExtracted = true;
      } else {
        items.push({
          sr: lotNo,
          description: lotName || categoryName,
          qty,
          unit,
          taxRate
        });
      }
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
    keyContacts,
    hasSubItemsExtracted
  };
}

async function backfillNestedItems() {
  console.log('Querying all mstc_auctions records...');
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, category_name, seller_name, location')
    .not('sanitized_document_path', 'is', null);

  if (error) {
    console.error('Failed to fetch records:', error.message);
    return;
  }

  console.log(`Scanning and backfilling nested sub-items for ${records?.length || 0} records...`);

  let count = 0;
  for (const r of records || []) {
    try {
      const res = await fetch(r.sanitized_document_path!);
      if (!res.ok) continue;
      const buffer = await res.buffer();
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') continue;

      const parsedPdf = await pdf(buffer);
      const text = parsedPdf.text;

      const summaryObj = parseMstcCatalogText(
        text,
        r.category_name || '',
        r.seller_name || '',
        r.location || ''
      );

      if (summaryObj.hasSubItemsExtracted) {
        count++;
        console.log(`[${count}] Detailed Nested List Found in ${r.mstc_auction_number}. Sub-items count: ${summaryObj.items.length}`);
        
        // Remove tracking flag before updating DB
        delete summaryObj.hasSubItemsExtracted;

        const { error: updateError } = await supabase
          .from('mstc_auctions')
          .update({
            raw_materials_text: JSON.stringify(summaryObj)
          })
          .eq('id', r.id);

        if (updateError) {
          console.error(`  - Failed to update record: ${updateError.message}`);
        } else {
          console.log(`  - Database successfully updated with sub-items.`);
        }
      }
    } catch (err: any) {
      // Quietly ignore download/parse errors for individual records
    }
  }

  console.log(`Backfill complete. Updated ${count} records with detailed sub-item listings.`);
}

backfillNestedItems();
