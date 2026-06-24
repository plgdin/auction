import type { MstcSanitizedAuction } from '../services/publicService.js';
import { 
  METALLIC_MODELS, 
  DEFAULT_MACRO_INPUTS, 
  predictPrice, 
  detectModelId, 
  detectGrade 
} from './metalValuationModels.js';
import { calculateLotValue } from './valuationUtils.js';

export { calculateLotValue };

export const expandAbbreviations = (text: string): string => {
  if (!text) return '';
  let result = text;
  
  const replacements: { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bGL\b/g, replacement: 'Galvalume' },
    { pattern: /\bG\.L\.\b/g, replacement: 'Galvalume' },
    { pattern: /\bGI\b/g, replacement: 'Galvanized Iron' },
    { pattern: /\bG\.I\.\b/g, replacement: 'Galvanized Iron' },
    { pattern: /\bMS\b/g, replacement: 'Mild Steel' },
    { pattern: /\bM\.S\.\b/g, replacement: 'Mild Steel' },
    { pattern: /\bSS\b/g, replacement: 'Stainless Steel' },
    { pattern: /\bS\.S\.\b/g, replacement: 'Stainless Steel' },
    { pattern: /\bAL\b/g, replacement: 'Aluminum' },
    { pattern: /\bA\.L\.\b/g, replacement: 'Aluminum' },
    { pattern: /\bZN\b/g, replacement: 'Zinc Alloy' },
    { pattern: /\bZ\.N\.\b/g, replacement: 'Zinc Alloy' },
    { pattern: /\bT\/F\b/g, replacement: 'Transformer' },
    { pattern: /\bTF\b/g, replacement: 'Transformer' }
  ];

  for (const rep of replacements) {
    result = result.replace(rep.pattern, rep.replacement);
  }

  // Also handle specific technical/grade terms that might need neat expansion
  return result;
};

export const getEstimatedMarketPrice = (
  description: string,
  categoryName: string = '',
  _qty: string = '',
  _unit: string = ''
): string => {
  const desc = (description || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();

  // Metal-related check (iron, steel, ferrous, scrap, vehicle, car, bus, truck, transport, auto, etc.)
  const isMetal = 
    desc.includes('scrap') || desc.includes('waste') ||
    desc.includes('iron') || desc.includes('steel') || desc.includes('ferrous') ||
    desc.includes('vehicle') || desc.includes('car') || desc.includes('bus') || desc.includes('truck') || desc.includes('transport') || desc.includes('auto') ||
    cat.includes('iron') || cat.includes('steel') || cat.includes('ferrous') || cat.includes('scrap') || cat.includes('vehicle') || cat.includes('car');

  if (isMetal) {
    const modelId = detectModelId(description);
    if (modelId) {
      const grade = detectGrade(description, modelId);
      const region = 'Mumbai'; // Default region for global pricing feeds
      // Passing description as 5th argument in case predictPrice expects it
      const predicted = predictPrice(modelId, grade, region, DEFAULT_MACRO_INPUTS, description);
      const rounded = Math.round(predicted);
      const targetUnit = METALLIC_MODELS[modelId]?.targetUnit || 'Tons';
      const singularUnit = targetUnit === 'Tons' ? 'Ton' : targetUnit === 'Units' ? 'Unit' : targetUnit;
      return `₹${rounded.toLocaleString('en-IN')} / ${singularUnit}`;
    }
  }

  if (desc.includes('copper') || cat.includes('copper')) {
    return '₹780 / kg';
  }
  if (desc.includes('aluminum') || desc.includes('aluminium') || cat.includes('aluminum') || cat.includes('aluminium')) {
    return '₹235 / kg';
  }
  if (desc.includes('battery') || desc.includes('batteries') || cat.includes('battery') || cat.includes('batteries')) {
    return '₹120 / kg';
  }
  if (desc.includes('lead') || cat.includes('lead')) {
    return '₹185 / kg';
  }
  if (desc.includes('brass') || cat.includes('brass')) {
    return '₹480 / kg';
  }
  if (desc.includes('zinc') || cat.includes('zinc')) {
    return '₹220 / kg';
  }
  if (desc.includes('oil') || desc.includes('lubricating') || desc.includes('petroleum') || cat.includes('oil') || cat.includes('petroleum')) {
    return '₹85 / Liter';
  }
  if (desc.includes('wheat') || cat.includes('wheat')) {
    return '₹2,450 / Quintal';
  }
  if (desc.includes('rice') || desc.includes('paddy') || cat.includes('rice') || cat.includes('paddy')) {
    return '₹2,200 / Quintal';
  }
  if (desc.includes('coal') || desc.includes('lignite') || cat.includes('coal') || cat.includes('lignite')) {
    return '₹8,400 / Ton';
  }
  if (desc.includes('sand') || desc.includes('mine') || desc.includes('stone') || desc.includes('block') || cat.includes('sand') || cat.includes('mine') || cat.includes('stone') || cat.includes('block')) {
    return '₹4,500 / Ton';
  }
  if ((desc.includes('cable') || desc.includes('wire') || cat.includes('cable') || cat.includes('wire')) &&
      !desc.includes('drum') && !desc.includes('reel')) {
    return '₹340 / kg';
  }
  if (desc.includes('computer') || desc.includes('laptop') || desc.includes('it equipment') || cat.includes('computer') || cat.includes('laptop')) {
    return '₹14,500 / Unit';
  }
  return '₹2,500 / Ton';
};

export const getNumericQty = (qtyStr: string, unitStr: string = ''): number => {
  const clean = (qtyStr || '').replace(/,/g, '').trim();
  let num = parseFloat(clean);
  if (isNaN(num)) num = 1;
  if ((unitStr || '').toUpperCase().trim() === 'MT') {
    num = num * 1000;
  }
  return num;
};

export const getNumericPrice = (priceStr: string): number => {
  const clean = (priceStr || '').replace(/[^\d]/g, '');
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
};

export interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: { 
    sr: number | string; 
    description: string; 
    qty: string; 
    unit: string; 
    taxRate: string; 
    marketPrice: string;
    images?: string[];
    subItems?: { sr: number | string; description: string; qty: string; unit: string }[];
    pcbGroup?: string;
    productType?: string;
  }[];
  eligibility: string[];
  depositDetails: {
    emd: string;
    preBidDdg: string;
    adminCharges: string;
  };
  keyContacts: { role: string; name: string; email: string; phone?: string }[];
  preview_image_url?: string | null;
  extracted_images?: string[];
  inspectionSchedule?: string;
  auctionStartTime?: string;
  auctionCloseTime?: string;
  totalMarketValue?: number;
  auctionType?: string;
  complianceInfo?: ComplianceInfo;
  needsReview?: boolean;
  reviewReason?: string;
}

export interface ComplianceDocument {
  name: string;
  description: string;
  type: 'mandatory' | 'conditional';
}

export interface ComplianceInfo {
  requiredDocuments: ComplianceDocument[];
  gstStatus: {
    isRcm: boolean;
    type: string;
    description: string;
  };
}

export const deriveCompliance = (item: MstcSanitizedAuction, parsedEligibility?: string[]): ComplianceInfo => {
  const requiredDocuments: ComplianceDocument[] = [
    {
      name: 'Valid MSTC Buyer Registration',
      description: 'Active, verified buyer account on the official MSTC e-commerce portal.',
      type: 'mandatory'
    },
    {
      name: 'Income Tax PAN Card',
      description: 'Permanent Account Number matching the bidding entity.',
      type: 'mandatory'
    }
  ];

  const sellerUpper = (item.seller_name || '').toUpperCase();
  const categoryUpper = (item.category_name || '').toUpperCase();
  const textUpper = (item.raw_materials_text || '').toUpperCase();

  let hasHazardous = false;
  let hasEWaste = false;
  let hasRVSF = false;
  let hasItems = false;

  let itemsList: any[] = [];
  if (item.raw_materials_text) {
    try {
      const parsed = JSON.parse(item.raw_materials_text);
      if (parsed && Array.isArray(parsed.items)) {
        itemsList = parsed.items;
        hasItems = itemsList.length > 0;
      }
    } catch (e) {}
  }

  if (hasItems) {
    for (const lot of itemsList) {
      const descLower = (lot.description || '').toLowerCase();
      const pcbLower = (lot.pcbGroup || '').toLowerCase();
      
      if (
        descLower.includes('hazardous') || 
        descLower.includes('battery') || 
        descLower.includes('used oil') || 
        descLower.includes('waste oil') ||
        pcbLower.includes('hazardous')
      ) {
        hasHazardous = true;
      }
      if (
        descLower.includes('e-waste') || 
        descLower.includes('ewaste') || 
        descLower.includes('telecom') || 
        descLower.includes('cable') ||
        pcbLower.includes('e-waste') ||
        pcbLower.includes('ewaste')
      ) {
        hasEWaste = true;
      }
      if (
        pcbLower.includes('rvsf') ||
        descLower.includes('rvsf') ||
        descLower.includes('vehicle') ||
        descLower.includes('car ') ||
        descLower.includes('bus ') ||
        descLower.includes('truck') ||
        descLower.includes('sumo') ||
        descLower.includes('gypsy')
      ) {
        hasRVSF = true;
      }
    }
  }

  const isRcm = 
    sellerUpper.includes('BSNL') || 
    sellerUpper.includes('BHARAT SANCHAR') ||
    sellerUpper.includes('RAILWAY') || 
    sellerUpper.includes('POLICE') || 
    sellerUpper.includes('COURT') || 
    sellerUpper.includes('MINISTRY') || 
    sellerUpper.includes('MUNICIPAL') || 
    sellerUpper.includes('FOREST') || 
    sellerUpper.includes('GOVERNMENT') || 
    sellerUpper.includes('PORT') || 
    sellerUpper.includes('DEFENSE') || 
    sellerUpper.includes('DEFENCE') || 
    sellerUpper.includes('ORDNANCE') || 
    sellerUpper.includes('COMMISSIONER') || 
    sellerUpper.includes('AUTHORITY') || 
    sellerUpper.includes('CORPORATION') || 
    textUpper.includes('GST REQUIREMENT UNDER RCM') ||
    textUpper.includes('UNDER REVERSE CHARGE') ||
    (parsedEligibility && parsedEligibility.some(el => {
      const elUpper = el.toUpperCase();
      return elUpper.includes('RCM') || elUpper.includes('REVERSE CHARGE') || elUpper.includes('REVERSE-CHARGE');
    }));

  if (!isRcm) {
    requiredDocuments.push({
      name: 'GSTIN Registration Certificate',
      description: 'Active Goods and Services Tax Identification Number (GSTIN) certificate matching buyer profile.',
      type: 'mandatory'
    });
  }

  // SPCB Consent to Operate
  const needsSpcb = hasItems 
    ? hasHazardous 
    : (
        categoryUpper.includes('WASTE') || 
        categoryUpper.includes('BATTERY') || 
        categoryUpper.includes('OIL') || 
        categoryUpper.includes('HAZARDOUS') || 
        categoryUpper.includes('CHEMICAL') || 
        categoryUpper.includes('METAL') || 
        categoryUpper.includes('PLASTIC') || 
        categoryUpper.includes('RUBBER') ||
        (parsedEligibility && parsedEligibility.some(el => {
          const elUpper = el.toUpperCase();
          return elUpper.includes('SPCB') || elUpper.includes('PCB') || elUpper.includes('POLLUTION') || elUpper.includes('CONSENT TO OPERATE');
        }))
      );

  if (needsSpcb) {
    requiredDocuments.push({
      name: 'SPCB Consent to Operate (CTO)',
      description: 'State Pollution Control Board authorization/consent required for purchasing hazardous or regulated scrap.',
      type: 'conditional'
    });
  }

  // CPCB Registration
  const needsCpcb = hasItems 
    ? hasEWaste 
    : (
        categoryUpper.includes('E-WASTE') || 
        categoryUpper.includes('ELECTRONIC') || 
        categoryUpper.includes('TELECOM') || 
        (parsedEligibility && parsedEligibility.some(el => {
          const elUpper = el.toUpperCase();
          return elUpper.includes('CPCB') || elUpper.includes('E-WASTE') || elUpper.includes('EWASTE');
        }))
      );

  if (needsCpcb) {
    requiredDocuments.push({
      name: 'CPCB Recycler Registration',
      description: 'Central Pollution Control Board registration certificate for authorized e-waste recycling.',
      type: 'conditional'
    });
  }

  // ELV (End-Of-Life Vehicle)
  const needsElv = hasItems 
    ? hasRVSF 
    : (
        categoryUpper.includes('VEHICLE') || 
        categoryUpper.includes('CAR') || 
        categoryUpper.includes('BUS') || 
        categoryUpper.includes('TRUCK') || 
        categoryUpper.includes('DUMPER') || 
        categoryUpper.includes('AUTOMOBILE') || 
        categoryUpper.includes('RVSF') ||
        (parsedEligibility && parsedEligibility.some(el => {
          const elUpper = el.toUpperCase();
          return elUpper.includes('ELV') || elUpper.includes('VEHICLE') || elUpper.includes('RTO') || elUpper.includes('DISMANTLING') || elUpper.includes('RVSF');
        }))
      );

  if (needsElv) {
    requiredDocuments.push({
      name: 'ELV Dismantling License / RVSF',
      description: 'Registered Vehicle Scrapping Facility (RVSF) or ELV license required for scrap vehicle dismantling.',
      type: 'conditional'
    });
  }

  // Timber / Forest Pass
  const needsTimber = 
    categoryUpper.includes('TIMBER') || 
    categoryUpper.includes('WOOD') || 
    categoryUpper.includes('FOREST') || 
    textUpper.includes('TIMBER') || 
    textUpper.includes('WOOD') || 
    textUpper.includes('TEAK') || 
    textUpper.includes('ROSEWOOD') || 
    textUpper.includes('LOG') || 
    textUpper.includes('FOREST') ||
    (parsedEligibility && parsedEligibility.some(el => {
      const elUpper = el.toUpperCase();
      return elUpper.includes('TIMBER') || elUpper.includes('TRANSIT PASS') || elUpper.includes('FOREST');
    }));

  if (needsTimber) {
    requiredDocuments.push({
      name: 'Forest Division Timber Transit Pass',
      description: 'Transit Pass (TP) or license issued by the Forest Department for timber purchase and transportation.',
      type: 'conditional'
    });
  }

  // Chartered Engineer Certificate
  const needsChartered = 
    textUpper.includes('DISMANTLING') || 
    textUpper.includes('DEMOLITION') || 
    textUpper.includes('MACHINERY') || 
    textUpper.includes('STRUCTURAL') || 
    textUpper.includes('DECOMMISSIONED') ||
    (parsedEligibility && parsedEligibility.some(el => {
      const elUpper = el.toUpperCase();
      return elUpper.includes('CHARTERED ENGINEER') || elUpper.includes('STABILITY CERTIFICATE') || elUpper.includes('DEMOLITION');
    }));

  if (needsChartered) {
    requiredDocuments.push({
      name: 'Chartered Engineer Safety Certificate',
      description: 'Safety / stability certificate from a certified Chartered Engineer for demolition or dismantling.',
      type: 'conditional'
    });
  }

  // General conditional parser check for any custom lines in parsedEligibility
  if (parsedEligibility && Array.isArray(parsedEligibility)) {
    parsedEligibility.forEach(el => {
      const lower = el.toLowerCase();
      if (
        lower.includes('license') || 
        lower.includes('certificate') || 
        lower.includes('permit') || 
        lower.includes('registration') || 
        lower.includes('passbook') || 
        lower.includes('consent')
      ) {
        // Avoid duplicate documents by checking standard words
        const standardWords = ['mstc', 'pan', 'gst', 'spcb', 'cpcb', 'elv', 'forest', 'chartered'];
        const isStandard = standardWords.some(w => lower.includes(w));
        if (!isStandard) {
          let docName = el;
          if (docName.length > 60) {
            docName = docName.substring(0, 57) + '...';
          }
          requiredDocuments.push({
            name: docName,
            description: el,
            type: 'conditional'
          });
        }
      }
    });
  }

  const gstStatus = {
    isRcm,
    type: isRcm ? 'Reverse Charge Mechanism (RCM)' : 'Regular GST Scheme',
    description: isRcm 
      ? 'GST is applicable under Reverse Charge Mechanism (RCM). Buyer (registered business) pays GST directly to the Government instead of the seller.'
      : 'GST is collected by the seller. Regular tax invoices will be issued post-auction.'
  };

  return {
    requiredDocuments,
    gstStatus
  };
};

export const parseAuctionType = (item: MstcSanitizedAuction): string => {
  if (!item) return 'O-General';
  
  const text = item.raw_materials_text || '';
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.auctionType && typeof parsed.auctionType === 'string') {
          return parsed.auctionType.trim();
        }
        if (parsed.typeOfAuction && typeof parsed.typeOfAuction === 'string') {
          return parsed.typeOfAuction.trim();
        }
      }
    } catch (e) {
      // Ignored
    }

    const regex = /(?:auction\s+type|type\s+of\s+auction|e-auction\s+type|auction_type)\s*[:=-]?\s*(O-[A-Za-z0-9_-]+(?:\s+Auction)?)/i;
    const match = text.match(regex);
    if (match && match[1]) {
      const val = match[1].trim();
      if (val.length > 2) return val;
    }

  }

  return 'O-General';
};

export const parsePdfDateTime = (dateTimeStr: string): Date | null => {
  if (!dateTimeStr) return null;
  const match = dateTimeStr.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += 2000;
    }
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }
  return null;
};

const formatDateDMY = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

export const flattenCatalogItems = (items: any[], categoryName: string = ''): any[] => {
  if (!items || !Array.isArray(items)) return [];
  const flattened: any[] = [];

  const isInstruction = (text: string): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('guide for making payment') ||
      lower.includes('emd ledger will be given effect') ||
      lower.includes('the bid value shall be the basic price') ||
      lower.includes('basic price of the material exclusive') ||
      lower.includes('bidders are advised to make pre-bid')
    );
  };

  for (const item of items) {
    if (isInstruction(item.description)) continue;

    let tax = item.taxRate || '';
    if (tax && tax.includes('%')) {
      const taxMatch = tax.match(/([\d\.]+)\s*%/);
      if (taxMatch && parseFloat(taxMatch[1]) > 100) {
        tax = 'As Applicable GST';
      }
    }

    if (item.subItems && Array.isArray(item.subItems) && item.subItems.length > 0) {
      item.subItems.forEach((sub: any, idx: number) => {
        if (isInstruction(sub.description)) return;
        
        let subDesc = expandAbbreviations(sub.description || '');
        subDesc = cleanMaterialDescription(subDesc);
        const subQty = sub.qty || '1';
        const subUnit = sub.unit || 'Nos';
        const subTax = tax || '18% GST';
        const subMPrice = getEstimatedMarketPrice(subDesc, categoryName);

        flattened.push({
          sr: `${item.sr}.${sub.sr || idx + 1}`,
          description: subDesc,
          qty: subQty,
          unit: subUnit,
          taxRate: subTax,
          marketPrice: subMPrice,
          attachments: item.attachments
        });
      });
    } else {
      let desc = item.description || '';
      if (desc && /^\d+$/.test(desc.trim())) {
        desc = categoryName || 'Auction Lot Items';
      }
      desc = expandAbbreviations(desc);
      desc = cleanMaterialDescription(desc);

      let mPrice = item.marketPrice || '';
      let parsedPrice = 0;
      if (mPrice) {
        const cleanP = mPrice.replace(/,/g, '');
        const match = cleanP.match(/₹\s*(\d+)/);
        parsedPrice = match ? parseInt(match[1], 10) : 0;
      }
      if (parsedPrice <= 1) {
        mPrice = getEstimatedMarketPrice(desc, categoryName);
      }

      flattened.push({
        ...item,
        description: desc,
        taxRate: tax,
        marketPrice: mPrice
      });
    }
  }

  return flattened;
};

/**
 * Cleans a lot's material description by stripping out metadata fields,
 * conditions, quantity phrases, and other noise.
 */
export function cleanMaterialDescription(desc: string): string {
  if (!desc) return '';
  let cleaned = desc;

  // New cleanups (Run specific warnings first to prevent generic split issues):
  // Remove Bidders Inspection & Caveat Emptor warnings
  cleaned = cleaned.replace(/\bBidders\s+are\s+required\s+to\s+inspect\s+the\s+site[\s\S]{1,180}?\bcaveat\s+emptor\s+shall\s+apply\s*(?:for\s+this\s+e[- ]auction)?\.?\b/gi, '');

  // Remove Standard "Sale is on as is where is" clause in brackets
  cleaned = cleaned.replace(/\[\s*Sale\s+is\s+on\s+as\s+is\s+where\s+is[\s\S]{1,250}?\bno\s+sorting\s+of\s+items\s+shall\s+be\s+allowed\s*\.?\s*\]/gi, '');

  // Remove Annual Rate Contract details in brackets
  cleaned = cleaned.replace(/\[\s*ARC\s*\(Annual\s+Rate\s+Contract\)[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[\s*Annual\s+Rate\s+Contract\s*\(ARC\)[^\]]*\]/gi, '');

  // Remove Pre-bid EMD amounts in brackets
  cleaned = cleaned.replace(/\[\s*pre-bid\/EMD\s+amount\s*-[^\]]*\]/gi, '');

  // Remove details/FDT/IT warnings at the end (place it/ before it\b)
  cleaned = cleaned.replace(/\b(?:Complete\s+)?details\s+as\s+per\s+(?:lot\s+)?annexure\s*(?:applicable)?\s*(?:it\/|it\b)?/gi, '');
  cleaned = cleaned.replace(/\b(?:Details\s+)?FDT\s+(?:and|&)\s+IT\/?\s*$/gi, '');
  cleaned = cleaned.replace(/\b(?:Applicable\s+)?FDT\s+(?:and|&)\s+IT\/?\s*$/gi, '');

  // 1. Remove "Note: ..." / "Note- ..." and everything after it
  cleaned = cleaned.replace(/\bNote\s*[:.-].*$/gi, '');

  // 2. Remove "Location: ..." and everything after it
  cleaned = cleaned.replace(/\bLocation\s*[:.-].*$/gi, '');
  cleaned = cleaned.replace(/\bLot Location\s*[:.-].*$/gi, '');

  // 3. Remove "Total Qty: ... No" / "Qty- 250 Nos" / "Quantity ..."
  cleaned = cleaned.replace(/\b(?:Approx\s*)?(?:Qty|Quantity|QTY|Total\s*Qty)\s*[:.-]?\s*\d+[\d,.]*\s*(?:Nos?|No|Items?|Lots?|Units?|Kgs?|MT|Tons?|Pcs?|[a-zA-Z]+)?/gi, '');

  // 4. Remove "Cond: ..." or "Condition: ..."
  cleaned = cleaned.replace(/\bCond(?:ition)?\s*[:.-]?\s*[a-zA-Z0-9-+/]+/gi, '');

  // 5. Remove "As per Lot Annexure" or "As per Annexure" or "As per ... Annexure"
  cleaned = cleaned.replace(/As per\s+(?:Lot\s+)?Annexure(?:\s+\S+)?/gi, '');

  // 6. Remove "CLICK HERE FOR ITEMS PHOTOGRAPH" / "CLICK HERE FOR ITEMS PHOTOGRAP H" / "CLICK HERE"
  cleaned = cleaned.replace(/\bCLICK\s*HERE\s*(?:FOR\s+[A-Za-z0-9\s-]{1,30})?/gi, '');

  // 7. Strip known metadata prefixes/fields and their values (strict word-count limits or specific matches)
  cleaned = cleaned.replace(/PCB Group\s*[:.-]\s*[A-Za-z0-9&/–—-]+/gi, '');
  cleaned = cleaned.replace(/Product Type\s*[:.-]\s*(?:[A-Za-z0-9&/–—-]+\s*){1,2}/gi, '');
  cleaned = cleaned.replace(/Category\s*[:.-]\s*(?:End of life vehicles|Ferro-Alloys\s*&\s*Metal Scrap|Batteries\s*&\s*Electrical Scrap|[A-Za-z0-9&/–—-]+\s*){1,4}/gi, '');
  cleaned = cleaned.replace(/Lot State\s*[:.-]\s*(?:[A-Za-z0-9&/–—-]+\s*){1,2}/gi, '');
  cleaned = cleaned.replace(/State\s*[:.-]\s*(?:[A-Za-z0-9&/–—-]+\s*){1,2}/gi, '');

  // 7b. Remove contact details / complete details / inspection details at the end
  cleaned = cleaned.replace(/\b(?:Contact\s*Person|Contact|Inspection|Contact\s*No|Complete\s+details)\b.*$/gi, '');

  // Clean up punctuation, spaces, etc.
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*[,:-]\s*/, '')
    .replace(/\s*[,:-]\s*$/, '')
    .replace(/\s*[.,:\-/]\s*$/, '') // Strip trailing dots, dashes, commas, slashes
    .trim();

  // 8. Strip stray words at the start
  cleaned = cleaned.replace(/^vehicles\b/gi, '');

  // Clean again after stripping leading word
  cleaned = cleaned
    .replace(/^\s*[,:-]\s*/, '')
    .replace(/\s*[.,:\-/]\s*$/, '')
    .trim();

  return cleaned;
}

export const generateCatalogSummary = (item: MstcSanitizedAuction): CatalogSummary => {
  if (!item) {
    return {
      overview: '',
      scopeOfWork: '',
      items: [],
      eligibility: [],
      depositDetails: { emd: '', preBidDdg: '', adminCharges: '' },
      keyContacts: [],
      inspectionSchedule: '',
      auctionStartTime: '',
      auctionCloseTime: ''
    } as any;
  }
  const shortId = (item.mstc_auction_number || '').split('/').pop() || item.id?.substring(0, 8) || 'N/A';
  let fallbackPreBid = '₹50,000';
  const shortIdNum = parseInt(shortId, 10);
  if (!isNaN(shortIdNum)) {
    if (shortIdNum % 4 === 0) fallbackPreBid = '₹1,00,000';
    else if (shortIdNum % 4 === 1) fallbackPreBid = '₹25,000';
    else if (shortIdNum % 4 === 2) fallbackPreBid = '₹1,50,000';
    else fallbackPreBid = '₹50,000';
  }

  // Create default/mock dates
  const mockStart = new Date(item.opening_date || Date.now());
  const mockClose = new Date(mockStart.getTime() + 6 * 60 * 60 * 1000); // +6 hours
  const mockInspStart = new Date(mockStart.getTime() - 14 * 24 * 60 * 60 * 1000);
  const mockInspEnd = new Date(mockStart.getTime() - 1 * 24 * 60 * 60 * 1000);

  const defaultInspectionSchedule = `${formatDateDMY(mockInspStart)} to ${formatDateDMY(mockInspEnd)}`;
  const defaultAuctionStartTime = `${formatDateDMY(mockStart)} 12:00`;
  const defaultAuctionCloseTime = `${formatDateDMY(mockClose)} 18:00`;

  if (item.raw_materials_text) {
    try {
      const parsed = JSON.parse(item.raw_materials_text);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.items &&
        parsed.eligibility &&
        parsed.depositDetails &&
        parsed.keyContacts
      ) {
        // EMD extraction/cleaning logic
        let emdVal = parsed.depositDetails.emd || '';
        let preBidDdg = parsed.depositDetails.preBidDdg;

        if (emdVal.includes('%')) {
          const percentMatch = emdVal.match(/([\d\.]+)\s*%/);
          if (percentMatch) {
            const percentVal = parseFloat(percentMatch[1]);
            if (percentVal > 100) {
              emdVal = '10% of total bid value';
              preBidDdg = 'Not required for registered MSME bidders';
            }
          }
        } else {
          const numMatch = emdVal.match(/([\d\.]+)/);
          if (numMatch) {
            const val = parseFloat(numMatch[1]);
            if (val > 100) {
              preBidDdg = `₹${val.toLocaleString('en-IN')}`;
              emdVal = '10% of total bid value';
            }
          }
        }

        const finalPreBid = preBidDdg && !preBidDdg.toLowerCase().includes('not required')
          ? preBidDdg
          : fallbackPreBid;

        parsed.depositDetails.emd = emdVal;
        parsed.depositDetails.preBidDdg = finalPreBid;

        if (parsed.items && Array.isArray(parsed.items)) {
          parsed.items = parsed.items.map((lot: any) => {
            let desc = lot.description || '';
            if (desc && /^\d+$/.test(desc.trim())) {
              desc = item.category_name || 'Auction Lot Items';
            }

            // Extract real description from subItems if available (for existing DB records)
            if (lot.subItems && Array.isArray(lot.subItems) && lot.subItems.length > 0) {
              const validSubs = lot.subItems.filter((sub: any) => {
                if (!sub.description) return false;
                const lower = sub.description.toLowerCase();
                return !(
                  lower.includes('guide for making payment') ||
                  lower.includes('emd ledger will be given effect') ||
                  lower.includes('the bid value shall be the basic price') ||
                  lower.includes('basic price of the material exclusive') ||
                  lower.includes('bidders are advised to make pre-bid')
                );
              });

              if (validSubs.length > 0) {
                const subDesc = cleanMaterialDescription(validSubs[0].description);
                // Only merge if they are different and subDesc is not just a tiny generic string
                if (subDesc.length > 3) {
                  const cleanedDesc = cleanMaterialDescription(desc);
                  const normCleaned = cleanedDesc.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
                  const normSub = subDesc.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();

                  const isDuplicate = 
                    normCleaned === normSub || 
                    normSub.includes(normCleaned) || 
                    normCleaned.includes(normSub);

                  if (!isDuplicate) {
                     desc = `${cleanedDesc} - ${subDesc}`;
                  } else if (subDesc.length > cleanedDesc.length) {
                     desc = subDesc;
                  } else {
                     desc = cleanedDesc;
                  }
                }
              }
            } else {
              desc = cleanMaterialDescription(desc);
            }

            desc = expandAbbreviations(desc);

            let tax = lot.taxRate || '';
            if (tax) {
              if (tax.includes('%')) {
                const taxMatch = tax.match(/([\d\.]+)\s*%/);
                if (taxMatch && parseFloat(taxMatch[1]) > 100) {
                  tax = 'As Applicable GST';
                }
              }
            }

            // Correctly parse and preserve db market price if it's not a placeholder
            let mPrice = lot.marketPrice || '';
            let parsedPrice = 0;
            if (mPrice) {
              const cleanP = mPrice.replace(/,/g, '');
              const match = cleanP.match(/₹\s*(\d+)/);
              parsedPrice = match ? parseInt(match[1], 10) : 0;
            }
            if (parsedPrice <= 1) {
              mPrice = getEstimatedMarketPrice(desc, item.category_name);
            }

            let lotQty = lot.qty;
            let lotUnit = lot.unit;
            if (lot.subItems && lot.subItems.length > 0) {
              // Always derive qty from sub-items when available — the sub-item
              // count is the most reliable source of truth from the parsed PDF.
              // The catalog qty is often garbage like "1 AC + 1,005 NOS" or
              // generic "1.0 LOT".
              lotQty = String(lot.subItems.length);
              lotUnit = 'Items';
            }

            return {
              ...lot,
              description: desc,
              qty: lotQty,
              unit: lotUnit,
              taxRate: tax,
              marketPrice: mPrice
            };
          });
        }

        const finalInspectionSchedule = parsed.inspectionSchedule || defaultInspectionSchedule;
        const finalAuctionStartTime = parsed.auctionStartTime || defaultAuctionStartTime;
        const finalAuctionCloseTime = parsed.auctionCloseTime || defaultAuctionCloseTime;

        return {
          ...parsed,
          inspectionSchedule: formatInspectionSchedule(finalInspectionSchedule),
          auctionStartTime: finalAuctionStartTime,
          auctionCloseTime: finalAuctionCloseTime,
          auctionType: parseAuctionType(item),
          complianceInfo: deriveCompliance(item, parsed.eligibility)
        };
      }
    } catch (e) {
      console.warn('Failed to parse raw_materials_text as JSON, falling back to mock generator:', e);
    }
  }

  const cat = (item.category_name || '').toUpperCase();
  const seller = (item.seller_name || '').toUpperCase();

  let overview = `This auction is conducted by MSTC on behalf of ${item.seller_name} for the disposal of surplus assets, equipment, and scrap materials located at ${item.location || 'various sites'}.`;
  let scopeOfWork = `Disposal and clearance of decommissioned industrial assets and general scrap material. All materials are offered strictly on an "As-Is-Where-Is" basis.`;

  let items = [
    { sr: 1, description: 'Mixed Ferrous Scrap (MS Pipes, Angle, Channels)', qty: '12.5', unit: 'MT', taxRate: '18% GST' },
    { sr: 2, description: 'Non-Ferrous Scrap (Aluminum cables & Copper windings)', qty: '1,850', unit: 'Kgs', taxRate: '18% GST' },
    { sr: 3, description: 'Unserviceable Batteries & Used Lubricating Oil', qty: '45', unit: 'Nos', taxRate: '18% GST + TCS' },
    { sr: 4, description: 'Obsolete Machinery Parts & Hand Tools', qty: '1', unit: 'Lot', taxRate: '18% GST' }
  ];

  let eligibility = [
    'Valid MSTC Buyer Registration.',
    'GSTIN Registration Certificate matching buyer profile.',
    'Hazardous waste buyers must possess active State Pollution Control Board (SPCB) authorization.'
  ];

  let keyContacts = [
    { role: 'Auction Officer (MSTC)', name: 'S. K. Mukherjee', email: 'skmukherjee@mstcindia.co.in' },
    { role: 'Site In-Charge', name: 'R. K. Sharma (Superintending Engineer)', email: 'rksharma@site-authority.org' }
  ];

  let emd = '10% of total bid value to be submitted via pre-bid EMD link';
  let adminCharges = '₹11,800 (incl. GST) non-refundable service provider fees';

  if (cat.includes('ROADWAYS') || cat.includes('TRANSPORT')) {
    overview = `Disposal of unserviceable motor vehicles, bus scrap, tyre assemblies, and associated automobile waste from ${item.seller_name} depots.`;
    scopeOfWork = `Complete dismantling, lifting, and clearing of designated scrap transport assets from the depot premises within the specified deadline.`;
    items = [
      { sr: 1, description: 'Scrap Condemned Buses (without tyres & batteries)', qty: '8', unit: 'Units', taxRate: '18% GST' },
      { sr: 2, description: 'Used Automobile Tyres (Various sizes, worn out)', qty: '120', unit: 'Nos', taxRate: '18% GST' },
      { sr: 3, description: 'Lead Acid Batteries (Unserviceable)', qty: '35', unit: 'Nos', taxRate: '18% GST' },
      { sr: 4, description: 'Waste Gear & Lubricating Oil (in drums)', qty: '1,200', unit: 'Liters', taxRate: '18% GST + 1% TCS' }
    ];
    eligibility.push('Automobile recycler license / lead smelter certificate required for Lot 3.');
  } else if (cat.includes('TELECOM') || cat.includes('BSNL') || cat.includes('COMMUNICATION')) {
    overview = `Sale of telecom infrastructure scrap, office equipment, batteries, and underground cables decommissioned by ${item.seller_name}.`;
    scopeOfWork = `Safe extraction, lifting, and environment-compliant transport of copper/telecom scrap from exchange storage locations.`;
    items = [
      { sr: 1, description: 'Decommissioned Copper Cables (Pipes/Wires)', qty: '4.2', unit: 'MT', taxRate: '18% GST' },
      { sr: 2, description: 'SMPS Power Plant Panels & Rack Units', qty: '12', unit: 'Lots', taxRate: '18% GST' },
      { sr: 3, description: 'Unserviceable Valve Regulated Lead Acid (VRLA) Battery Banks', qty: '18', unit: 'Sets', taxRate: '18% GST' },
      { sr: 4, description: 'E-Waste (Telecom switches, cards, & motherboards)', qty: '650', unit: 'Kgs', taxRate: '18% GST' }
    ];
    eligibility.push('CPCB/SPCB E-Waste registration required for Lot 3 and Lot 4.');
  } else if (seller.includes('INVESTIGATION') || seller.includes('POLICE') || seller.includes('COURT')) {
    overview = `Auction of seized, confiscated, or unclaimed vehicles and miscellaneous goods under the authority of ${item.seller_name}.`;
    scopeOfWork = `Lifting of vehicles/goods in "as-is" condition. Registration documents or salvage papers will be issued as per court/department rules.`;
    items = [
      { sr: 1, description: 'Confiscated Light Motor Vehicles (SUVs, Sedans)', qty: '4', unit: 'Units', taxRate: '12% GST' },
      { sr: 2, description: 'Two-Wheelers (Motorcycles, Scooters)', qty: '15', unit: 'Units', taxRate: '12% GST' },
      { sr: 3, description: 'Unclaimed Miscellaneous Electronic Items', qty: '1', unit: 'Lot', taxRate: '18% GST' }
    ];
    eligibility = [
      'Valid Indian citizenship proof (Aadhaar/PAN).',
      'No pending criminal record declarations.',
      'Active MSTC registration.'
    ];
  } else if (cat.includes('MECHANICAL') || cat.includes('DRILLING') || cat.includes('ENGINEERING')) {
    overview = `Disposal of unserviceable drilling rigs, heavy plant machinery, compressor units, and metal scrap of ${item.seller_name}.`;
    scopeOfWork = `Heavy loading, mechanical dismantling, and clearance of rig attachments and scrap iron components from the engineering depot yard.`;
    items = [
      { sr: 1, description: 'Condemned Compressor Units & Air Dryers', qty: '3', unit: 'Units', taxRate: '18% GST' },
      { sr: 2, description: 'Heavy Duty Drilling Rig Parts (Unserviceable)', qty: '9.8', unit: 'MT', taxRate: '18% GST' },
      { sr: 3, description: 'Used Lubricants & Engine Oil (drums included)', qty: '800', unit: 'Liters', taxRate: '18% GST' },
      { sr: 4, description: 'Turnings, Borings & Miscellaneous Iron Scrap', qty: '14', unit: 'MT', taxRate: '18% GST' }
    ];
    eligibility.push('Heavy crane entry permit must be cleared with site security 24 hours prior to lifting.');
  }

  const enrichedItems = items.map(lot => ({
    ...lot,
    marketPrice: getEstimatedMarketPrice(lot.description, item.category_name)
  }));

  return {
    overview,
    scopeOfWork,
    items: enrichedItems,
    eligibility,
    depositDetails: {
      emd,
      preBidDdg: fallbackPreBid,
      adminCharges
    },
    keyContacts,
    inspectionSchedule: formatInspectionSchedule(defaultInspectionSchedule),
    auctionStartTime: defaultAuctionStartTime,
    auctionCloseTime: defaultAuctionCloseTime,
    auctionType: parseAuctionType(item),
    complianceInfo: deriveCompliance(item, eligibility)
  };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function formatDateToOrdinal(dateStr: string): string {
  if (!dateStr) return '';
  // match DD-MM-YYYY, DD-MM-YY, or DD-MM, with any slash or dash or dot
  const match = dateStr.trim().match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (!match) return dateStr;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const yearStr = match[3];
  
  if (isNaN(day) || isNaN(month) || month < 1 || month > 12) {
    return dateStr;
  }
  const monthName = MONTHS[month - 1];
  if (yearStr) {
    let year = parseInt(yearStr, 10);
    if (year < 100) year += 2000;
    return `${getOrdinalSuffix(day)} ${monthName} ${year}`;
  }
  return `${getOrdinalSuffix(day)} ${monthName}`;
}

export function formatInspectionSchedule(schedule: string | undefined): string {
  if (!schedule) return 'N/A';
  const dates = schedule.match(/\b\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?\b/g);
  if (dates && dates.length === 2) {
    const start = formatDateToOrdinal(dates[0]);
    const end = formatDateToOrdinal(dates[1]);
    return `${start} to ${end}`;
  }
  if (dates && dates.length === 1) {
    return formatDateToOrdinal(dates[0]);
  }
  return schedule;
}

export function formatDateOrdinal(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : '';

  const day = date.getDate();
  const monthName = MONTHS[date.getMonth()];
  const year = date.getFullYear();

  return `${getOrdinalSuffix(day)} ${monthName} ${year}`;
}

export function formatDateTimeOrdinal(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : '';

  const datePart = formatDateOrdinal(date);
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  return `${datePart}, ${hours}:${minutes} ${ampm}`;
}

export interface CatalogValidationResult {
  needsReview: boolean;
  reason: string;
}

export function validateCatalogDescriptions(
  items: any[],
  categoryName: string
): CatalogValidationResult {
  if (!items || items.length === 0) {
    return { needsReview: true, reason: 'No items parsed from catalog PDF' };
  }

  const issues: string[] = [];
  for (const item of items) {
    const desc = (item.description || '').trim();
    const subItemsCount = item.subItems?.length || 0;

    if (desc.length === 0) {
      issues.push(`Lot ${item.sr} description is empty`);
      continue;
    }

    if (desc.length < 8) {
      if (/^\d+$/.test(desc)) {
        issues.push(`Lot ${item.sr} description contains only numbers ("${desc}")`);
      } else {
        issues.push(`Lot ${item.sr} description is too short ("${desc}")`);
      }
      continue;
    }

    const lowerDesc = desc.toLowerCase();
    const lowerCat = (categoryName || '').toLowerCase();
    if (lowerDesc === 'auction lot items' || lowerDesc === 'vehicles' || lowerDesc === 'tenders') {
      issues.push(`Lot ${item.sr} description is a generic placeholder ("${desc}")`);
      continue;
    }

    if (lowerDesc === lowerCat && subItemsCount === 0) {
      issues.push(`Lot ${item.sr} has fallback description matching category exactly, with no sub-items`);
      continue;
    }

    if (/\b(?:pcb group|product type|lot state)\b/i.test(desc)) {
      issues.push(`Lot ${item.sr} description contains metadata residue`);
      continue;
    }
  }

  if (issues.length > 0) {
    return {
      needsReview: true,
      reason: issues.slice(0, 3).join(', ') + (issues.length > 3 ? ` (+${issues.length - 3} more)` : '')
    };
  }

  return { needsReview: false, reason: '' };
}
