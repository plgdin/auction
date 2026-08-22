export interface GemExtractedData {
  sellerAuctioneerName?: string | null;
  sellerRole?: string | null;
  ministry?: string | null;
  organisation?: string | null;
  department?: string | null;
  division?: string | null;
  referenceNo?: string | null;
  emdAmount?: string | null;
  quantityStr?: string | null;
  officers: { name: string; phone?: string; email?: string; role?: string }[];
}

const INVALID_NAME_WORDS = new Set([
  'IOD', 'OF', 'FOR', 'AND', 'THE', 'VIEW', 'MORE', 'START', 'END', 'DATE',
  'PERIOD', 'METHOD', 'EVENT', 'NOTICE', 'DOCUMENT', 'AUCTION', 'GEM',
  'INDIA', 'STATE', 'CITY', 'ORDER', 'OFFICE', 'CANTEEN', 'PURPOSES', 'RENTING',
  'DISPOSAL', 'SCRAP', 'UNSERVICEABLE', 'ARTICLES', 'E-AUCTION', 'EAUCTION', 'PUBLIC'
]);

export function parseGemNoticeContent(rawText = '', title = ''): GemExtractedData {
  const combined = `${title}\n${rawText || ''}`;
  const lines = combined
    .split(/[\n\r]+/)
    .map((l) => l.trim().replace(/^[-•*–]\s*/, ''))
    .filter(Boolean);

  // 1. Seller / Auctioneer Name & Role (e.g. "Seller/Auctioneer Name : Monisankar Hazra-Auctioneer")
  let sellerAuctioneerName: string | null = null;
  let sellerRole = 'Auctioneer';

  const sellerMatch = combined.match(
    /(?:Seller\s*\/\s*Auctioneer\s*Name|Auctioneer\s*Name|Seller\s*Name)\s*[:=-]\s*([^\n\r]+)/i
  );
  if (sellerMatch) {
    const rawSeller = sellerMatch[1].trim();
    if (rawSeller.includes('-')) {
      const parts = rawSeller.split('-');
      sellerAuctioneerName = parts[0].trim();
      sellerRole = parts.slice(1).join('-').trim() || 'Auctioneer';
    } else {
      sellerAuctioneerName = rawSeller;
    }
  }

  // 2. Ministry (e.g. "Ministry of Petroleum and Natural Gas")
  let ministry: string | null = null;
  const ministryMatch = combined.match(/Ministry\s+of\s+[A-Za-z\s&,]+/i);
  if (ministryMatch) {
    ministry = ministryMatch[0].trim();
  }

  // 3. Organisation / PSU (e.g. "INDIAN OIL CORPORATION LIMITED", "Food Corporation of India (FCI)")
  let organisation: string | null = null;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (
      upper.includes('CORPORATION') ||
      upper.includes('LIMITED') ||
      upper.includes('LTD') ||
      upper.includes('INSTITUTE') ||
      upper.includes('AUTHORITY') ||
      upper.includes('BOARD') ||
      upper.includes('PORT TRUST') ||
      upper.includes('INDIAN OIL') ||
      upper.includes('FCI') ||
      upper.includes('IIT') ||
      upper.includes('RAILWAY') ||
      upper.includes('BHEL') ||
      upper.includes('ONGC') ||
      upper.includes('SAIL') ||
      upper.includes('GAIL') ||
      upper.includes('NTPC')
    ) {
      if (
        !upper.includes('MINISTRY OF') &&
        !upper.includes('SELLER/AUCTIONEER') &&
        !upper.includes('DEPARTMENT OF') &&
        !upper.includes('VIEW MORE') &&
        line.length < 80
      ) {
        organisation = line.replace(/^[-\s]+/, '');
        break;
      }
    }
  }

  // 4. Department / Division (e.g. "Marketing Division", "Directorate of Medical Education")
  let department: string | null = null;
  let division: string | null = null;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('division') && !lower.includes('divisional office') && line.length < 60) {
      division = line.replace(/^[-\s]+/, '');
    } else if (
      (lower.includes('department') || lower.includes('directorate')) &&
      !lower.includes('ministry of') &&
      line !== organisation &&
      line.length < 80
    ) {
      department = line.replace(/^[-\s]+/, '');
    }
  }

  // 5. Internal Reference No (e.g. "WRMC/2026-27/PT/202")
  let referenceNo: string | null = null;
  const refMatch = combined.match(
    /(?:Reference\s*No\.?|Ref\s*No\.?|Tender\s*Ref)\s*[:=-]\s*([A-Za-z0-9\/-]+)/i
  );
  if (refMatch) {
    referenceNo = refMatch[1].trim();
  }

  // 6. EMD & Quantity
  let emdAmount: string | null = null;
  const emdMatch = combined.match(/(?:EMD|Earnest Money|Caution Money|Deposit)\s*[:=-]?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d+)?)/i);
  if (emdMatch) {
    emdAmount = `₹ ${emdMatch[1]}`;
  }

  let quantityStr: string | null = null;
  const qtyMatch = combined.match(/(?:Quantity|Total Qty|Lot Size|Total Weight)\s*[:=-]?\s*([\d,]+(?:\.\d+)?\s*(?:MT|Tons?|Kg|Nos?|Units?|Lots?|Items?|Sq\.?\s*Mtr|Ltr))/i);
  if (qtyMatch) {
    quantityStr = qtyMatch[1];
  }

  // 7. Officers & Contact List
  const officers: { name: string; phone?: string; email?: string; role?: string }[] = [];

  if (sellerAuctioneerName && sellerAuctioneerName.length > 2) {
    const upperWords = sellerAuctioneerName.toUpperCase().split(/\s+/);
    if (!upperWords.some((w) => INVALID_NAME_WORDS.has(w))) {
      officers.push({
        name: sellerAuctioneerName,
        role: sellerRole || 'Auctioneer',
      });
    }
  }

  // Extract phone numbers
  const phoneMatches = Array.from(
    new Set(
      combined.match(
        /\b[6-9]\d{9}\b|\b\d{5}\s*\d{5}\b|\b0\d{2,4}[-\s]?\d{6,8}\b/g
      ) || []
    )
  );

  // Extract emails
  const emailMatches = Array.from(
    new Set(
      combined.match(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
      ) || []
    )
  );

  // Extract explicitly named officers with phone (e.g. "Dilip Gangad- 96199 03684")
  const personPhoneRegex =
    /(?:(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Er\.?|Contact)\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*(?:-|–|:|Mobile\s*(?:No\.?)?|Phone\s*(?:No\.?)?|\/)\s*([6-9]\d{9}|\d{5}\s*\d{5}|0\d{2,4}[-\s]?\d{6,8})/gi;
  let pMatch;
  while ((pMatch = personPhoneRegex.exec(combined)) !== null) {
    const rawName = pMatch[1].trim();
    const phone = pMatch[2].replace(/[\s-]/g, '');
    const upperWords = rawName.toUpperCase().split(/\s+/);
    const isInvalid = upperWords.some((w) => INVALID_NAME_WORDS.has(w)) || rawName.length <= 2;

    if (!isInvalid && !officers.some((o) => o.phone === phone)) {
      officers.push({
        name: rawName,
        phone: phone,
        role: 'Contact Officer',
      });
    }
  }

  // Attach phones to existing officers or add helpline contacts
  phoneMatches.forEach((ph, i) => {
    const cleanPh = ph.replace(/[\s-]/g, '');
    if (!officers.some((o) => o.phone === cleanPh)) {
      if (officers.length > 0 && !officers[0].phone) {
        officers[0].phone = cleanPh;
      } else {
        officers.push({
          name: `Nodal Officer / Helpline ${i + 1}`,
          phone: cleanPh,
          email: emailMatches[i] || undefined,
          role: 'Official Contact',
        });
      }
    }
  });

  return {
    sellerAuctioneerName,
    sellerRole,
    ministry,
    organisation,
    department,
    division,
    referenceNo,
    emdAmount,
    quantityStr,
    officers,
  };
}
