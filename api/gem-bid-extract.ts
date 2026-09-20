import https from 'https';
import http from 'http';
import { URL } from 'url';
import pdf from 'pdf-parse';
import { isAllowedOrigin } from './_utils/cors.js';
import { supabase } from '../scraper/utils/common/storage.js';

export function parseGemPdfText(text: string) {
  // 1. Extract Item Categories
  let items: string[] = [];
  const catMatch = text.match(/(?:व'तु\s*\(ेणी\s*\/Item Category|Item Category)\s*\n([\s\S]*?)(?=(?:GeMARPTS|बीओBयू|BOQ|अनुबंध|Contract Period|उEह|वषG|वष8|MSE|Startup|व<े ता|वLे ता|Experience|Dated|Bid Number|1दनांक|\?दनांक|\+यूनतम|Minimum Average|Turnover))/i);
  if (catMatch) {
    const rawCategories = catMatch[1].replace(/\n+/g, ' ').trim();
    items = rawCategories.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  }

  // Check Schedule table if available
  const scheduleItems: Array<{ name: string; quantity: string }> = [];
  const scheduleMatches = [...text.matchAll(/Schedule\s*(\d+)\s*([^0-9\n]+?)\s*(\d+)/gi)];
  if (scheduleMatches.length > 0) {
    for (const sm of scheduleMatches) {
      scheduleItems.push({
        name: sm[2].trim(),
        quantity: sm[3].trim()
      });
    }
  }

  // 2. Extract item details with quantities
  const itemDetails = items.map((fullName, idx) => {
    // Check if schedule has it
    if (scheduleItems[idx] && scheduleItems[idx].quantity) {
      return {
        id: idx + 1,
        name: fullName,
        quantity: scheduleItems[idx].quantity
      };
    }

    // Try matching product code first
    const codeMatch = fullName.match(/[A-Z0-9]+-[A-Z0-9-]+/i);
    let qty: string | null = null;

    if (codeMatch) {
      const code = codeMatch[0];
      const codeRegex = new RegExp(code + '[\\s\\S]{0,50}?\\(\\s*([\\d,]+\\s*[a-zA-Z]+)\\s*\\)', 'i');
      const m = text.match(codeRegex);
      if (m) qty = m[1].replace(/\n+/g, ' ').trim();
    }

    if (!qty) {
      const firstWord = fullName.split(/[\s-]+/)[0];
      if (firstWord && firstWord.length > 3) {
        const regex = new RegExp(firstWord + '[\\s\\S]{0,80}?\\(\\s*([\\d,]+\\s*[a-zA-Z]+)\\s*\\)', 'i');
        const m = text.match(regex);
        if (m) qty = m[1].replace(/\n+/g, ' ').trim();
      }
    }

    if (!qty) {
      const firstWord = fullName.split(/[\s-]+/)[0];
      const tableRegex = new RegExp(firstWord + '[\\s\\S]*?(?:Haridwar|Pan-India|CITY|Office|VISHAKHAPATNAM|DELHI|MUMBAI|[A-Za-z]+)[\\s\\S]*?(\\d+)\\s*15', 'i');
      const tm = text.match(tableRegex);
      if (tm) qty = tm[1].trim();
    }

    return {
      id: idx + 1,
      name: fullName,
      quantity: qty
    };
  });

  // 3. Extract Delivery Address
  let address: string | null = null;
  const addrMatch = text.match(/(?:following address|Actual delivery[^\n:]*[:\n]+)([\s\S]*?)(?=(?:\n\n|\n[A-Z0-9.\s]+:|\nBUYER|\nOPTION|\nCONSIGN|\nCONFLICT|\n■|\.|\z))/i)
    || text.match(/Beneficiary\s*:\s*\n([\s\S]*?)(?=(?:बोली|Bid splitting|EMD|ePBG|\n\n))/i);
  if (addrMatch) {
    const lines = addrMatch[1].split('\n').map(l => l.trim()).filter(l => l && l !== '.' && !l.includes('---'));
    address = lines.join(', ');
  }

  // 4. Extract Total Quantity
  const qtyMatch = text.match(/(?:कु ल\s*मा\s*ा|Total Quantity)\s*(\d+)/i);
  const totalQty = qtyMatch ? qtyMatch[1] : null;

  // 5. Extract Grievance Emails
  let hodEmail: string | null = null;
  let buyerEmail: string | null = null;
  const hodMatch = text.match(/HOD Email id\s*:\s*([^\s\n]+)/i);
  if (hodMatch && hodMatch[1] && !hodMatch[1].toLowerCase().includes('buyer') && hodMatch[1] !== 'undefined') {
    hodEmail = hodMatch[1].trim();
  }
  const buyerMatch = text.match(/Buyer Email id\s*:\s*([^\s\n]+)/i);
  if (buyerMatch && buyerMatch[1] && buyerMatch[1] !== 'undefined') {
    buyerEmail = buyerMatch[1].trim();
  }

  // 6. Extract Organisation & Ministry
  let organisation: string | null = null;
  const orgMatch = text.match(/(?:Organisation Name|संगठन\s*का\s*नाम)\s*([^\n]+)/i);
  if (orgMatch) organisation = orgMatch[1].trim();

  let ministry: string | null = null;
  const minMatch = text.match(/Ministry\/State Name\s*([^\n]+)/i);
  if (minMatch) ministry = minMatch[1].trim();

  let department: string | null = null;
  const depMatch = text.match(/Department Name\s*([^\n]+)/i);
  if (depMatch) department = depMatch[1].trim();

  // 7. BOQ Title
  let boqTitle: string | null = null;
  const boqMatch = text.match(/(?:बीओBयू\s*शीष%क|BOQ Title)\s*([^\n]+)/i);
  if (boqMatch) boqTitle = boqMatch[1].trim();

  return {
    items: itemDetails,
    address,
    totalQty,
    hodEmail,
    buyerEmail,
    organisation,
    ministry,
    department,
    boqTitle
  };
}

function fetchPdfBuffer(urlStr: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPdfBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any): Promise<void> {
  const origin = req.headers.origin || req.headers.Origin || '';
  const corsOrigin = isAllowedOrigin(origin) ? origin : (process.env.NODE_ENV === 'production' ? 'https://lelam.co' : '*');

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const bidNumber = (req.query?.bid_number as string) || new URL(req.url, 'http://localhost').searchParams.get('bid_number');
  if (!bidNumber) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing bid_number parameter' }));
    return;
  }

  try {
    // 1. Fetch bid from database
    const { data: bid, error } = await supabase
      .from('gem_bids')
      .select('*')
      .eq('bid_number', bidNumber)
      .single();

    if (error || !bid) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bid not found' }));
      return;
    }

    // 2. Check if bid is already expanded and has no ellipsis
    if (bid.items && !bid.items.includes('...') && bid.raw_description && bid.raw_description.includes('OFFICIAL PROCUREMENT SPECIFICATIONS')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        alreadyExtracted: true,
        items: bid.items,
        category_name: bid.category_name,
        department_name: bid.department_name,
        raw_description: bid.raw_description
      }));
      return;
    }

    // 3. Determine document URL
    let docUrl = bid.document_url;
    if (!docUrl) {
      const bidSafe = bidNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      docUrl = `https://xnhtcswiteuiggaipzvj.supabase.co/storage/v1/object/public/auction_documents/gem-bids/${bidSafe}/official_bid_document.pdf`;
    }

    // 4. Download and parse PDF
    const pdfBuf = await fetchPdfBuffer(docUrl);
    const pdfData = await pdf(pdfBuf);
    const parsed = parseGemPdfText(pdfData.text);

    // 5. Format items string
    const itemsFormatted = parsed.items.map(it => {
      return it.quantity ? `${it.name} (Qty: ${it.quantity})` : it.name;
    }).join(', ');

    // 6. Format raw description
    const lines: string[] = [
      `OFFICIAL PROCUREMENT SPECIFICATIONS & SCHEDULE DETAILS (GeM Bid: ${bidNumber})\n`,
      `• Procuring Organisation: ${parsed.organisation || bid.department_name || 'Government Department'} | ${parsed.department || 'Department'} | ${parsed.ministry || 'Ministry'}`,
      `• Total Quantity: ${parsed.totalQty || bid.quantity || 'As per Schedule'} Units (${parsed.items.length} Itemized Procurement Schedules)`,
      parsed.boqTitle ? `• BOQ Title: ${parsed.boqTitle}` : '',
      `• Bid Type: Two Packet Bid | Bid to RA: Enabled`,
      `\nITEM-WISE BREAKDOWN & DELIVERY SCHEDULE:`
    ].filter(Boolean);

    parsed.items.forEach((it, idx) => {
      lines.push(`${idx + 1}. ${it.name} — Quantity: ${it.quantity ? (it.quantity.toLowerCase().includes('unit') || it.quantity.toLowerCase().includes('liter') || it.quantity.toLowerCase().includes('piece') ? it.quantity : `${it.quantity} Units`) : 'As per Bid Schedule'}`);
    });

    if (parsed.buyerEmail || parsed.hodEmail) {
      lines.push('\nGRIEVANCE REDRESSAL & BUYER DETAILS:');
      if (parsed.buyerEmail) lines.push(`• Buyer Email: ${parsed.buyerEmail}`);
      if (parsed.hodEmail) lines.push(`• HOD Email: ${parsed.hodEmail}`);
    }

    if (parsed.address) {
      lines.push('\nACTUAL DELIVERY, INSTALLATION & COMMISSIONING LOCATION:');
      lines.push(parsed.address);
    }

    lines.push('\nBUYER ADDED BID SPECIFIC TERMS & CONDITIONS:');
    lines.push('1. OPTION CLAUSE: Purchaser reserves right to increase/decrease quantity up to 25% at placement of contract and during contract currency.');
    lines.push('2. MSE & MII PREFERENCE: Purchase preference applicable as per Government of India public procurement policies.');

    const newRawDescription = lines.join('\n');

    // 7. Update database
    await supabase
      .from('gem_bids')
      .update({
        items: itemsFormatted,
        category_name: parsed.boqTitle ? `${parsed.boqTitle} (BOQ)` : bid.category_name,
        department_name: parsed.organisation ? `${parsed.organisation}, ${parsed.department || ''}, ${parsed.ministry || ''}`.replace(/,\s*,/g, ',').trim() : bid.department_name,
        raw_description: newRawDescription
      })
      .eq('bid_number', bidNumber);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      items: itemsFormatted,
      category_name: parsed.boqTitle ? `${parsed.boqTitle} (BOQ)` : bid.category_name,
      department_name: parsed.organisation || bid.department_name,
      raw_description: newRawDescription,
      address: parsed.address
    }));
  } catch (err: any) {
    console.error('Extraction error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to extract document' }));
  }
}
