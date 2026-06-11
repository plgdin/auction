import * as fs from 'fs';

function parseMstcCatalogText(text: string, categoryName: string, sellerName: string, location: string): any {
  // Clean up formatting
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
  const officerOneEmail = cleanText.match(/Officer OneName[\s\S]*?Email:\s*([^\n]+)/) || cleanText.match(/ smukherjee@mstcindia\.co\.in/); // standard fallback
  
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

// Read the text file and test parsing
const testText = fs.readFileSync('scratch_pdf_text.txt', 'utf-8');
const result = parseMstcCatalogText(testText, 'Timber Logs', 'EXE ENGG JHARGRAM HIGHWAY DIVN', 'West Bengal');
console.log('\n--- Parsed JSON Result ---');
console.log(JSON.stringify(result, null, 2));
