/**
 * Backfill script: Parse all already-downloaded PDFs that are missing structured JSON summaries.
 * This fetches each PDF from Supabase storage, extracts text via pdf-parse, runs the
 * MSTC catalog parser, and writes the resulting JSON into raw_materials_text.
 */
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env keys.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// ── Parser (same as assetWorker.ts) ──────────────────────────────────────────
function parseMstcCatalogText(text: string, categoryName: string, sellerName: string, location: string): any {
  const lines = text.split('\n').map(l => l.trim());
  const cleanText = lines.join('\n');

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
        description: lotName || categoryName || 'Auction Lot Items',
        qty,
        unit,
        taxRate: `${gst} GST${tcs && tcs !== '0.0' && tcs !== '0' ? ' + ' + tcs + '% TCS' : ''}`
      });
    }
  }

  if (items.length === 0) {
    items.push({ sr: 1, description: categoryName || 'Auction Lot Items', qty: '1', unit: 'Lot', taxRate: '18% GST' });
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

  // 7. Extract inspection and auction dates
  let inspectionSchedule = '';
  const inspectionMatch = cleanText.match(/Inspection Schedule\s*:\s*([^\n]+)/i);
  if (inspectionMatch) {
    inspectionSchedule = inspectionMatch[1].trim();
  }

  let auctionStartTime = '';
  const startMatch = cleanText.match(/Scheduled Auction Start Date\s*and Time\s*:\s*\n*([^\n]+)/i);
  if (startMatch) {
    auctionStartTime = startMatch[1].trim();
  }

  let auctionCloseTime = '';
  const closeMatch = cleanText.match(/Scheduled Auction Close\s*Date and Time\s*:\s*\n*([^\n]+)/i);
  if (closeMatch) {
    auctionCloseTime = closeMatch[1].trim();
  }

  return {
    overview, scopeOfWork, items, eligibility,
    depositDetails: {
      emd: emdValue,
      preBidDdg: 'Not required for registered MSME bidders',
      adminCharges: '₹11,800 (incl. GST) non-refundable service provider fees'
    },
    keyContacts,
    inspectionSchedule,
    auctionStartTime,
    auctionCloseTime
  };
}

// ── Helper: check if a string is already valid structured JSON ────────────────
function isValidParsedJson(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && obj.items && obj.eligibility && obj.depositDetails && obj.inspectionSchedule;
  } catch {
    return false;
  }
}

// ── Main backfill ────────────────────────────────────────────────────────────
async function backfillParsing() {
  // Fetch all completed records
  const { data: records, error } = await supabase
    .from('mstc_auctions')
    .select('id, mstc_auction_number, sanitized_document_path, raw_materials_text, category_name, seller_name, location')
    .eq('asset_status', 'completed')
    .not('sanitized_document_path', 'is', null);

  if (error) {
    console.error('Query failed:', error.message);
    return;
  }

  // Filter to only records that need parsing (we force re-parse by checking for inspectionSchedule)
  const needsParsing = (records || []).filter(r => !isValidParsedJson(r.raw_materials_text));

  console.log(`Total completed records: ${records?.length || 0}`);
  console.log(`Already parsed (valid JSON): ${(records?.length || 0) - needsParsing.length}`);
  console.log(`Need parsing: ${needsParsing.length}`);

  if (needsParsing.length === 0) {
    console.log('Nothing to do — all records already have valid parsed JSON.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const record of needsParsing) {
    try {
      process.stdout.write(`[${success + failed + 1}/${needsParsing.length}] ${record.mstc_auction_number} ... `);

      const res = await fetch(record.sanitized_document_path!);
      if (!res.ok) {
        console.log(`SKIP (fetch ${res.status})`);
        failed++;
        continue;
      }

      const buffer = await res.buffer();

      // Verify it's a real PDF
      if (buffer.toString('utf-8', 0, 4) !== '%PDF') {
        console.log('SKIP (not a PDF)');
        failed++;
        continue;
      }

      const parsedPdf = await pdf(buffer);
      if (!parsedPdf?.text) {
        console.log('SKIP (no text extracted)');
        failed++;
        continue;
      }

      const summaryObj = parseMstcCatalogText(
        parsedPdf.text,
        record.category_name || '',
        record.seller_name || '',
        record.location || ''
      );

      const jsonStr = JSON.stringify(summaryObj);

      const { data: updatedData, error: updateErr } = await supabase
        .from('mstc_auctions')
        .update({ raw_materials_text: jsonStr })
        .eq('id', record.id)
        .select();

      if (updateErr) {
        console.log(`FAIL (db update: ${updateErr.message})`);
        failed++;
      } else if (!updatedData || updatedData.length === 0) {
        console.log(`FAIL (0 rows updated - RLS policy or wrong ID)`);
        failed++;
      } else {
        console.log(`OK (${summaryObj.items.length} lots, ${jsonStr.length} chars)`);
        success++;
      }
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n─── Backfill Complete ───`);
  console.log(`  ✓ Parsed: ${success}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total:    ${needsParsing.length}`);
}

backfillParsing();
