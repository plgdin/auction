import type { MstcSanitizedAuction } from '../services/publicService';
import { 
  METALLIC_MODELS, 
  DEFAULT_MACRO_INPUTS, 
  predictPrice, 
  detectModelId, 
  detectGrade 
} from './metalValuationModels';
import { calculateLotValue } from './valuationUtils';

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

export const getEstimatedMarketPrice = (description: string, categoryName: string = ''): string => {
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
    const grade = detectGrade(description, modelId);
    const region = 'Mumbai'; // Default region for global pricing feeds
    const predicted = predictPrice(modelId, grade, region, DEFAULT_MACRO_INPUTS);
    const rounded = Math.round(predicted);
    const targetUnit = METALLIC_MODELS[modelId]?.targetUnit || 'Tons';
    const singularUnit = targetUnit === 'Tons' ? 'Ton' : targetUnit === 'Units' ? 'Unit' : targetUnit;
    return `₹${rounded.toLocaleString('en-IN')} / ${singularUnit}`;
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
    subItems?: { sr: number | string; description: string; qty: string; unit: string }[];
  }[];
  eligibility: string[];
  depositDetails: {
    emd: string;
    preBidDdg: string;
    adminCharges: string;
  };
  keyContacts: { role: string; name: string; email: string }[];
  preview_image_url?: string | null;
  extracted_images?: string[];
  inspectionSchedule?: string;
  auctionStartTime?: string;
  auctionCloseTime?: string;
  totalMarketValue?: number;
}

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
        
        const subDesc = expandAbbreviations(sub.description || '');
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

export const generateCatalogSummary = (item: MstcSanitizedAuction): CatalogSummary => {
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
  let fallbackPreBid = '₹50,000';
  const shortIdNum = parseInt(shortId, 10);
  if (!isNaN(shortIdNum)) {
    if (shortIdNum % 4 === 0) fallbackPreBid = '₹1,00,000';
    else if (shortIdNum % 4 === 1) fallbackPreBid = '₹25,000';
    else if (shortIdNum % 4 === 2) fallbackPreBid = '₹1,50,000';
    else fallbackPreBid = '₹50,000';
  }

  // Create default/mock dates
  const mockStart = new Date(item.opening_date);
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
          auctionCloseTime: finalAuctionCloseTime
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
    auctionCloseTime: defaultAuctionCloseTime
  };
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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