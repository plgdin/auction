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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function parseMstcCatalogText(text: string, categoryName: string, sellerName: string, location: string): any {
  const lines = text.split('\n').map(l => l.trim());
  const cleanText = lines.join('\n');

  let emdValue = '10% of total bid value';
  let preBidDdg = 'Not required for registered MSME bidders';

  // EMD & Pre-Bid Percentage
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

  // Explicit Pre-Bid Amount
  const explicitPreBidMatch = cleanText.match(/(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]{4,10})/i);
  if (explicitPreBidMatch) {
    const val = explicitPreBidMatch[1].replace(/,/g, '');
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 100) {
      preBidDdg = `₹${num.toLocaleString('en-IN')}`;
    }
  }

  // Contacts
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

  // Lots
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

      const taxRate = `${gst} GST${tcs && tcs !== '0.0' && tcs !== '0' ? ' + ' + tcs + '% TCS' : ''}`;

      // Try sub-item lookback extraction in primary catalog
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
        }

        if (subQty) {
          let desc = '';
          for (let k = j - 1; k >= 0; k--) {
            const prevLine = blockLines[k];
            if (prevLine.includes('Lot No -') || prevLine.includes('Lot Name -') || prevLine.includes('Product Type -') || prevLine.toLowerCase().startsWith('qty')) {
              break;
            }
            desc = prevLine.trim() + ' ' + desc;
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

  // Extract Inspection details
  let inspectionTime = "From publication date to 1 day prior to bidding (10:00 AM - 4:00 PM on working days)";
  let inspectionContact = "Site In-Charge / Contact Person listed in catalog";

  const insTimeMatch = cleanText.match(/(?:Inspection\s*(?:Date\s*&?\s*Time|Period|From|Allowed)?\s*[:\-]|Inspection\s*Date\s*[:\-]?)\s*([^\n]+)/i);
  if (insTimeMatch) {
    const val = insTimeMatch[1].trim();
    if (val && val.length > 5 && val.length < 250) {
      inspectionTime = val.replace(/[\[\{\(]\s*[-_.\s]*\s*[\]\}\)]/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  const insContMatch = cleanText.match(/(?:Contact\s*Person\s*for\s*Inspection|Inspection\s*Contact|Contact\s*Person\s*)\s*[:\-]?\s*([^\n]+)/i);
  if (insContMatch) {
    const val = insContMatch[1].trim();
    if (val && val.length > 3 && val.length < 150) {
      inspectionContact = val.replace(/[\[\{\(]\s*[-_.\s]*\s*[\]\}\)]/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    }
  } else if (contactName) {
    inspectionContact = `${contactName} (${contactPhone || "phone listed in catalog"})`;
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
    inspectionDetails: {
      time: inspectionTime,
      contact: inspectionContact
    }
  };
}

function parseAnnexItems(text: string, taxRate: string): any[] {
  const items: any[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const itemPattern = /^(\d+)\.?\s+([A-Za-z0-9_\-\s,\(\)\/\.]{3,70})\s+([\d,.]+)\s*([A-Za-z]{2,10})/i;
  
  let currentSr = 1;
  for (const line of lines) {
    if (
      line.toLowerCase().includes("page") ||
      line.toLowerCase().includes("tender") ||
      line.toLowerCase().includes("mstc") ||
      line.toLowerCase().includes("quantity") ||
      line.toLowerCase().includes("description")
    ) {
      continue;
    }
    
    const match = line.match(itemPattern);
    if (match) {
      const parsedSr = parseInt(match[1], 10);
      const desc = match[2].trim();
      const qtyStr = match[3].replace(/,/g, '');
      const unit = match[4].trim();
      const qtyVal = parseFloat(qtyStr);
      if (!isNaN(qtyVal) && qtyVal > 0 && desc.length > 2) {
        items.push({
          sr: parsedSr || currentSr,
          description: desc,
          qty: qtyStr,
          unit: unit || 'Nos',
          taxRate
        });
        currentSr++;
      }
    } else {
      const qtyMatch = line.match(/([A-Za-z0-9_\-\s,\(\)\/\.]{3,50})\s+(?:Qty|Quantity|Nos)\s*[:\-]?\s*([\d,.]+)\s*([A-Za-z]{2,10})?/i);
      if (qtyMatch) {
        const desc = qtyMatch[1].trim();
        const qtyStr = qtyMatch[2].replace(/,/g, '');
        const unit = qtyMatch[3] || 'Nos';
        const qtyVal = parseFloat(qtyStr);
        if (!isNaN(qtyVal) && qtyVal > 0 && desc.length > 2) {
          items.push({
            sr: currentSr,
            description: desc,
            qty: qtyStr,
            unit: unit.trim(),
            taxRate
          });
          currentSr++;
        }
      }
    }
  }
  return items;
}

async function downloadAttachment(fileName: string, docType: string, headers: Record<string, string>): Promise<Buffer | null> {
  const url = `https://www.mstcecommerce.com/auctionhome/mstc/download_file.jsp?file_name=${fileName}&doc_type=${docType}`;
  try {
    const res = await fetch(url, { headers } as any);
    if (!res.ok) return null;
    const buf = await res.buffer();
    if (buf.toString('utf-8', 0, 4) === '%PDF') return buf;
  } catch {}
  return null;
}

async function backfillAllAnnexes() {
  console.log('Fetching all records from Supabase...');
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, category_name, seller_name, location, source_pdf_url')
    .not('sanitized_document_path', 'is', null);

  if (error) {
    console.error('Failed to query records:', error.message);
    return;
  }

  console.log(`Scanning and parsing annex PDFs for ${records?.length || 0} records...`);

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  };

  for (const r of records || []) {
    try {
      console.log(`Processing: ${r.mstc_auction_number}`);
      const res = await fetch(r.sanitized_document_path!);
      if (!res.ok) continue;
      const fileBuffer = await res.buffer();
      if (fileBuffer.toString('utf-8', 0, 4) !== '%PDF') continue;

      const parsedPdf = await pdf(fileBuffer);
      const mainText = parsedPdf.text || '';

      // Find annex filenames
      const cleanedText = mainText.replace(/\r?\n/g, ' ').replace(
        /(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
        (_match: any, p1: any, p2: any, p3: any, p4: any) => `${p1}${p2}${p3 || ''}${p4}`
      );
      const matches = cleanedText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
      const uniqueAttachments = Array.from(new Set(matches)).filter(name => {
        const n = (name as string).toLowerCase();
        return n.startsWith('photo_') || n.startsWith('annex_');
      }) as string[];

      let annexItems: any[] = [];
      for (const fileName of uniqueAttachments) {
        const primaryType = fileName.toLowerCase().startsWith('photo_') ? 'attached_photo' : 'attached_annex';
        const fallbackType = primaryType === 'attached_photo' ? 'attached_annex' : 'attached_photo';

        console.log(`  Downloading attachment: ${fileName}`);
        let docBuffer = await downloadAttachment(fileName, primaryType, headers);
        if (!docBuffer) {
          docBuffer = await downloadAttachment(fileName, fallbackType, headers);
        }

        if (docBuffer) {
          try {
            const parsedDoc = await pdf(docBuffer);
            if (parsedDoc && parsedDoc.text) {
              let parsedItems: any[] = [];
              if (parsedDoc.text.includes("Lot No -")) {
                const tempSummary = parseMstcCatalogText(parsedDoc.text, '', '', '');
                parsedItems = tempSummary.items;
              } else {
                parsedItems = parseAnnexItems(parsedDoc.text, "As Applicable GST");
              }
              if (parsedItems.length > 0) {
                console.log(`    Found ${parsedItems.length} items inside ${fileName}`);
                annexItems.push(...parsedItems);
              }
            }
          } catch (e: any) {
            console.warn(`    Failed to parse text from ${fileName}:`, e.message);
          }
        }
      }

      const summaryObj = parseMstcCatalogText(mainText, r.category_name || '', r.seller_name || '', r.location || '');
      
      if (annexItems.length > 0) {
        const mainItemsAreGeneric = summaryObj.items.every((it: any) => 
          it.qty === '1' && it.unit.toLowerCase() === 'lot'
        );
        if (mainItemsAreGeneric) {
          console.log(`  Replacing generic main items with detailed annex items.`);
          summaryObj.items = annexItems;
        } else {
          console.log(`  Appending detailed annex items.`);
          summaryObj.items = [...summaryObj.items, ...annexItems];
        }
      }

      // Preserve existing preview_image_url and extracted_images if present
      const { data: currentRecord } = await supabase
        .from('mstc_auctions')
        .select('raw_materials_text')
        .eq('id', r.id)
        .single();
      
      if (currentRecord?.raw_materials_text) {
        try {
          const oldObj = JSON.parse(currentRecord.raw_materials_text);
          summaryObj.preview_image_url = oldObj.preview_image_url;
          summaryObj.extracted_images = oldObj.extracted_images;
        } catch {}
      }

      const { error: updateError } = await supabase
        .from('mstc_auctions')
        .update({
          raw_materials_text: JSON.stringify(summaryObj)
        })
        .eq('id', r.id);

      if (updateError) {
        console.error(`  Failed to update database: ${updateError.message}`);
      } else {
        console.log(`  Database successfully updated for ${r.mstc_auction_number} with ${summaryObj.items.length} items.`);
      }
    } catch (err: any) {
      console.error(`  Error processing record:`, err.message);
    }
  }

  console.log('Backfill finished!');
}

backfillAllAnnexes();
