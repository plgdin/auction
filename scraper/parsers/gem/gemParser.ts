/**
 * GeM Portal Listing & Notice Detail Parser
 *
 * Extracts structured auction data from:
 * 1. The GeM Forward Auction listing DOM card
 * 2. The full GeM Auction Notice detail document (/eprocure/view-auction-notice/<id>/...)
 */
import { mapCategory } from "../../utils/common/categoryMapper.js";
import { logger } from "../../utils/common/logger.js";
import {
  parseIndianPrice,
  parseIndianPriceRange,
  type ParsedPriceRange,
} from "../../utils/common/priceParser.js";

export * from "./gemBusinessRulesParser.js";
export * from "./gemDocumentPageParser.js";

const log = logger.child({ module: "gemParser" });

export interface GeMItemSchedule {
  item_no: string;
  item_name: string;
  quantity: string;
  purchased_year?: string;
  brand_name?: string;
  specs?: string;
}

export interface GeMListing {
  gem_auction_id: string;
  title: string;
  reserve_price_text?: string;
  reserve_price_value?: number | null;
  reserve_price_value_min?: number | null;
  reserve_price_value_max?: number | null;
  bid_increment_amount?: number | null;
  ministry?: string;
  department?: string;
  organisation?: string;
  office_zone?: string;
  state?: string;
  city?: string;
  district?: string;
  pincode?: string;
  full_address?: string;
  location: string;
  location_unparsed?: boolean;
  auction_start_date?: string | null;
  auction_end_date?: string | null;
  start_date_unparsed?: boolean;
  end_date_unparsed?: boolean;
  auction_status?: string | null;
  source_url: string;
  rules_url?: string;
  doc_page_url?: string;
  document_url?: string;
  document_urls?: string[];
  corrigendum_urls?: string[];
  documents_archived?: boolean;
  documents_archived_at?: string;
  preview_url?: string;
  extracted_pdf_text?: string;
  boq_items?: any[];
  discovered_api_attachments?: any[];
  inspection_date?: string | null;
  inspection_location?: string | null;
  is_reauction?: boolean;
  original_auction_id?: string | null;
  extend_time_last_bid_min?: number | null;
  extend_time_by_min?: number | null;
  auto_extension_mode?: string;
  emd_in_favour_of?: string;
  category_name: string;
  raw_description?: string;
  detailed_description?: string;
  reference_no?: string;
  seller_name?: string;
  contact_phone?: string;
  contact_email?: string;
  emd_amount?: number | null;
  emd_mode?: string;
  emd_start_date?: string | null;
  emd_end_date?: string | null;
  bidding_access?: string;
  item_wise_time?: string;
  auto_extension?: string;
  bidding_template?: string;
  items_schedule?: GeMItemSchedule[];
}

export interface GeMNoticeDetails {
  ministry?: string;
  department?: string;
  organisation?: string;
  seller_name?: string;
  seller_role?: string;
  reference_no?: string;
  category_name?: string;
  auction_brief?: string;
  detailed_description?: string;
  pin_code?: string;
  city?: string;
  district?: string;
  state?: string;
  emd_amount?: number | null;
  emd_mode?: string;
  emd_start_date?: string | null;
  emd_end_date?: string | null;
  emd_in_favour_of?: string;
  inspection_date?: string | null;
  inspection_location?: string | null;
  auction_start_date?: string | null;
  auction_end_date?: string | null;
  auto_extension?: string;
  bidding_template?: string;
  bidding_access?: string;
  item_wise_time?: string;
  items_schedule?: GeMItemSchedule[];
  contact_phone?: string;
  contact_email?: string;
  corrigendum_urls?: string[];
}

/**
 * Detects whether an auction listing is a re-auction / re-tender and extracts original ID.
 */
export function detectGeMReAuction(
  title: string,
  description?: string
): {
  is_reauction: boolean;
  original_auction_id: string | null;
  isReAuction: boolean;
  originalAuctionId: string | null;
} {
  const combined = `${title} ${description || ""}`;
  const reMatch = combined.match(
    /\b(re-?auction|re-?tender|2nd\s*call|3rd\s*call|second\s*call|third\s*call)\b/i
  );
  if (!reMatch) {
    return {
      is_reauction: false,
      original_auction_id: null,
      isReAuction: false,
      originalAuctionId: null,
    };
  }

  let origId: string | null = null;
  const idMatch = combined.match(
    /(?:re-?auction\s+(?:of|against)|against\s+auction|earlier\s+auction|previous\s+auction|(?:re-?auction|reauction)\s+(?:of\s+)?(?:auction\s+)?(?:id|no\.?))\s*[:#-]?\s*(\d{4,9})/i
  );
  if (idMatch) {
    origId = idMatch[1];
  }
  return {
    is_reauction: true,
    original_auction_id: origId,
    isReAuction: true,
    originalAuctionId: origId,
  };
}

export interface ParsedGeMLocation {
  state: string;
  city: string;
  pincode: string;
  location: string;
  location_unparsed: boolean;
}

function cleanHtmlText(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Status Normalizer ──────────────────────────────────────────────────────

/**
 * Normalizes raw DOM status text into canonical auction_status:
 * 'live' | 'upcoming' | 'closed' | 'cancelled' | null
 *
 * If no recognizable signal exists, returns null rather than guessing.
 */
export function normalizeGeMAuctionStatus(rawStatus: string | null | undefined): string | null {
  if (!rawStatus || typeof rawStatus !== "string") return null;

  const cleaned = rawStatus.trim().toLowerCase();
  if (!cleaned) return null;

  if (
    cleaned.includes("live") ||
    cleaned.includes("active") ||
    cleaned.includes("running") ||
    cleaned.includes("in progress") ||
    cleaned.includes("published")
  ) {
    return "live";
  }

  if (
    cleaned.includes("upcoming") ||
    cleaned.includes("scheduled") ||
    cleaned.includes("future") ||
    cleaned.includes("draft")
  ) {
    return "upcoming";
  }

  if (
    cleaned.includes("closed") ||
    cleaned.includes("ended") ||
    cleaned.includes("completed") ||
    cleaned.includes("expired") ||
    cleaned.includes("archived")
  ) {
    return "closed";
  }

  if (
    cleaned.includes("cancel") ||
    cleaned.includes("cancelled") ||
    cleaned.includes("canceled") ||
    cleaned.includes("revoked") ||
    cleaned.includes("corrigendum")
  ) {
    return "cancelled";
  }

  return null;
}

// ─── Price Parser ───────────────────────────────────────────────────────────

export {
  parseIndianPrice,
  parseIndianPriceRange,
  type ParsedPriceRange,
};

/**
 * Backward-compatible wrapper for GeM reserve price parsing.
 * Uses the shared parseIndianPrice utility.
 */
export function parseReservePrice(priceText: string | null | undefined): number | null {
  return parseIndianPrice(priceText);
}

// ─── Date Parser ────────────────────────────────────────────────────────────

/**
 * Parse GeM Portal date strings into ISO format.
 *
 * Supported formats:
 *   "25-07-2026 14:00:00"
 *   "25/07/2026 14:00:00"
 *   "25-07-2026 14:00"
 *   "25/07/2026 14:00"
 *   "25-07-2026"
 */
export function parseGeMDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;

  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
  const fullMatch = cleaned.match(
    /(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
  );
  if (fullMatch) {
    const [, day, month, year, hours, minutes, seconds] = fullMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
  }

  // DD-MM-YYYY HH:mm
  const noSecondsMatch = cleaned.match(
    /(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2})/
  );
  if (noSecondsMatch) {
    const [, day, month, year, hours, minutes] = noSecondsMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}:00+05:30`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dateOnlyMatch = cleaned.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return `${year}-${month}-${day}T00:00:00+05:30`;
  }

  // Fallback to JS native Date parsing
  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (err) {
    log.debug({ dateStr }, "Native Date parsing failed");
  }

  log.warn({ dateStr }, "Could not parse GeM Portal date");
  return null;
}

// ─── Location Parser ─────────────────────────────────────────────────────────

/**
 * Decompose a GeM Portal location string.
 * When no segment can be parsed, returns location_unparsed: true and empty fields.
 * Never defaults to "India".
 *
 * Example:
 *   "Kokrajhar - Kokrajhar - ASSAM - 783370"
 */
export function parseGeMLocation(locStr: string | null | undefined): ParsedGeMLocation {
  if (!locStr || typeof locStr !== "string") {
    return { state: "", city: "", pincode: "", location: "", location_unparsed: true };
  }

  const parts = locStr.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { state: "", city: "", pincode: "", location: "", location_unparsed: true };
  }

  if (parts.length >= 4) {
    const loc = parts[2] || parts[1] || parts[0] || "";
    return {
      city: parts[0] || "",
      state: parts[2] || "",
      pincode: parts[3] || "",
      location: loc,
      location_unparsed: !loc,
    };
  }

  if (parts.length === 3) {
    // City - State - Pincode
    const loc = parts[1] || parts[0] || "";
    return {
      city: parts[0] || "",
      state: parts[1] || "",
      pincode: parts[2] || "",
      location: loc,
      location_unparsed: !loc,
    };
  }

  if (parts.length === 2) {
    // City - State
    const loc = parts[1] || parts[0] || "";
    return {
      city: parts[0] || "",
      state: parts[1] || "",
      pincode: "",
      location: loc,
      location_unparsed: !loc,
    };
  }

  // Single segment
  const single = parts[0] || "";
  const hasDigits = /\d{6}/.test(single);
  if (hasDigits) {
    return {
      city: "",
      state: "",
      pincode: single,
      location: "",
      location_unparsed: true,
    };
  }

  return {
    city: single,
    state: "",
    pincode: "",
    location: single,
    location_unparsed: !single,
  };
}

export { parseGeMLocation as parseLocation };

// ─── Category Classification ──────────────────────────────────────────────────

/**
 * Classify a listing based on title and mapping dictionaries.
 */
export function classifyGeMListing(title: string): string {
  const result = mapCategory(title);
  return `${result.category} | ${result.subcategory}`;
}

// ─── Notice Detail HTML Parser ───────────────────────────────────────────────

/**
 * Parses full GeM Auction Notice HTML (/eprocure/view-auction-notice/<id>/...)
 * Extracts 100% of structured metadata, schedule of items, EMD, and contacts.
 */
export function parseGemNoticeHtml(html: string): GeMNoticeDetails {
  if (!html || typeof html !== "string") return {};

  const extractLabeledValue = (label: string): string => {
    // 1. Caption label with floatright colon followed by div > label
    const reCaption = new RegExp(
      `caption">\\s*${label}\\s*(?:<span[^>]*>[^<]*<\\/span>)?\\s*<\\/label>\\s*<div[^>]*>\\s*<label[^>]*>([\\s\\S]*?)<\\/label>`,
      "i"
    );
    const m1 = html.match(reCaption);
    if (m1 && cleanHtmlText(m1[1])) return cleanHtmlText(m1[1]);

    // 2. Generic label followed by label or div
    const reGen = new RegExp(
      `${label}\\s*(?:<span[^>]*>[^<]*<\\/span>)?\\s*<\\/label>[\\s\\S]*?<label[^>]*>([\\s\\S]*?)<\\/label>`,
      "i"
    );
    const m2 = html.match(reGen);
    if (m2 && cleanHtmlText(m2[1])) return cleanHtmlText(m2[1]);

    // 3. Fallback text pattern
    const reText = new RegExp(`${label}\\s*[:=-]\\s*([^\\n<]+)`, "i");
    const m3 = html.match(reText);
    if (m3 && cleanHtmlText(m3[1])) return cleanHtmlText(m3[1]);

    return "";
  };

  // 1. Office / Zone Hierarchy
  let ministry = "";
  let department = "";
  let organisation = "";
  const officeBlockMatch = html.match(
    /Office\/Zone[\s\S]*?<div class="ref-dept[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/i
  );
  if (officeBlockMatch) {
    const deptSpans =
      officeBlockMatch[1].match(/<span class="x-dept-name">([\s\S]*?)<\/span>/gi) || [];
    const cleanedDepts = deptSpans.map(cleanHtmlText).filter(Boolean);
    if (cleanedDepts.length > 0) ministry = cleanedDepts[0];
    if (cleanedDepts.length > 1) department = cleanedDepts[1];
    if (cleanedDepts.length > 2) organisation = cleanedDepts[2];
  }

  // 2. Seller Name & Role
  const rawSeller = extractLabeledValue("Seller/Auctioneer Name");
  let sellerName = "";
  let sellerRole = "Auctioneer";
  if (rawSeller) {
    if (rawSeller.includes("-")) {
      const parts = rawSeller.split("-");
      sellerName = parts[0].trim();
      sellerRole = parts.slice(1).join("-").trim() || "Auctioneer";
    } else {
      sellerName = rawSeller;
    }
  }

  // 3. Reference No & Category
  const referenceNo = extractLabeledValue("Reference No\\.?");
  const categoryName = extractLabeledValue("Category");

  // 4. Brief & Detailed Description
  const auctionBrief = extractLabeledValue("Auction Brief");
  const detailedDescription = extractLabeledValue("Auction Detail");

  // 5. Project Location Table
  let pinCode = "";
  let city = "";
  let district = "";
  let state = "";
  const locTableMatch = html.match(
    /Project Location - Pin Code[\s\S]*?<table[\s\S]*?<\/table>/i
  );
  if (locTableMatch) {
    const trs = locTableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trs) {
      const tds = (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map(cleanHtmlText);
      if (tds.length >= 5) {
        pinCode = tds[1];
        city = tds[2];
        district = tds[3];
        state = tds[4];
        break;
      }
    }
  }

  // 6. EMD Details
  const emdMode = extractLabeledValue("EMD Mode");
  const rawEmdAmount = extractLabeledValue("EMD");
  let emdAmount: number | null = null;
  if (
    rawEmdAmount &&
    !rawEmdAmount.toLowerCase().includes("no") &&
    !rawEmdAmount.toLowerCase().includes("yes")
  ) {
    const parsedNum = parseFloat(rawEmdAmount.replace(/,/g, ""));
    if (!isNaN(parsedNum)) emdAmount = parsedNum;
  }

  const emdStartDateStr = extractLabeledValue("EMD Payment Start Date");
  const emdEndDateStr = extractLabeledValue("EMD Payment End Date");
  const emdStartDate = parseGeMDate(emdStartDateStr);
  const emdEndDate = parseGeMDate(emdEndDateStr);

  // 7. Timing & Rules
  const startDateStr = extractLabeledValue("Auction Start Date & Time");
  const endDateStr = extractLabeledValue("Auction End Date & Time");
  const startDate = parseGeMDate(startDateStr);
  const endDate = parseGeMDate(endDateStr);

  const autoExtension = extractLabeledValue("Auto Extension");
  const biddingTemplate = extractLabeledValue("Bidding Template");
  const biddingAccess = extractLabeledValue("Bidding Access");
  const itemWiseTime = extractLabeledValue("Item wise Time");

  // 8. Schedule of Lots & Items Table
  const itemsSchedule: GeMItemSchedule[] = [];
  const allTables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const itemsTable = allTables.find(
    (t) =>
      /Items/i.test(t) &&
      (/Qty/i.test(t) || /Quantity/i.test(t) || /Purchased/i.test(t))
  );

  if (itemsTable) {
    const trs = itemsTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    let currentItem: GeMItemSchedule | null = null;
    for (const tr of trs) {
      const tds = (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map(cleanHtmlText);
      if (tds.length >= 3 && /^\d+$/.test(tds[0])) {
        currentItem = {
          item_no: tds[0],
          item_name: tds[1],
          quantity: tds[2],
          purchased_year: tds[3] || undefined,
          brand_name: tds[4] || undefined,
        };
        itemsSchedule.push(currentItem);
      } else if (tds.length === 1 && currentItem && tds[0]) {
        if (!currentItem.brand_name) currentItem.brand_name = tds[0];
        else currentItem.brand_name += "; " + tds[0];
      }
    }
  }

  // 9. Contact Phone & Email
  const combinedText = `${auctionBrief} ${detailedDescription}`;
  let contactPhone: string | undefined;
  let contactEmail: string | undefined;

  const phoneMatch = combinedText.match(
    /(?:phone|mobile|call|approach|contact|tel)?\s*(?:on|at|:)?\s*(\b[6-9]\d{9}\b)/i
  );
  if (phoneMatch) {
    contactPhone = phoneMatch[1];
  }

  const emailMatch = combinedText.match(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  if (
    emailMatch &&
    !emailMatch[1].includes("helpdesk-gem") &&
    !emailMatch[1].includes("support")
  ) {
    contactEmail = emailMatch[1];
  }

  // 10. Corrigendum Document URLs
  const corrigendumUrls: string[] = [];
  const corriMatches =
    html.match(/href=["']([^"']*(?:corrigendum|corri)[^"']*)["']/gi) || [];
  corriMatches.forEach((m) => {
    const urlMatch = m.match(/href=["']([^"']+)["']/i);
    if (urlMatch && !corrigendumUrls.includes(urlMatch[1])) {
      corrigendumUrls.push(urlMatch[1]);
    }
  });

  // 11. EMD In Favour Of / Payable To
  const emdInFavourOf =
    extractLabeledValue("EMD in favour of") ||
    extractLabeledValue("In favour of") ||
    extractLabeledValue("EMD Payable To") ||
    extractLabeledValue("Payable at");

  // 12. Inspection Schedule & Venue
  const rawInspDate =
    extractLabeledValue("Inspection Date") ||
    extractLabeledValue("Inspection Period") ||
    extractLabeledValue("Viewing Date");
  let inspectionDate = rawInspDate;
  if (!inspectionDate && detailedDescription) {
    const m = detailedDescription.match(
      /(?:inspection|viewing)\s*(?:date|period|time)\s*:?\s*([\d\-/]+\s*(?:to\s*[\d\-/]+)?)/i
    );
    if (m) inspectionDate = m[1].trim();
  }

  const rawInspLoc =
    extractLabeledValue("Inspection Location") ||
    extractLabeledValue("Inspection Venue") ||
    extractLabeledValue("Inspection Place");
  let inspectionLocation = rawInspLoc;
  if (!inspectionLocation && detailedDescription) {
    const m = detailedDescription.match(
      /(?:inspection|viewing)\s*(?:location|place|venue|address)\s*:?\s*([^\n.,;]{8,100})/i
    );
    if (m) inspectionLocation = m[1].trim();
  }

  return {
    ministry: ministry || undefined,
    department: department || undefined,
    organisation: organisation || undefined,
    seller_name: sellerName || undefined,
    seller_role: sellerRole || undefined,
    reference_no: referenceNo || undefined,
    category_name: categoryName || undefined,
    auction_brief: auctionBrief || undefined,
    detailed_description: detailedDescription || undefined,
    pin_code: pinCode || undefined,
    city: city || undefined,
    district: district || undefined,
    state: state || undefined,
    emd_amount: emdAmount,
    emd_mode: emdMode || undefined,
    emd_start_date: emdStartDate,
    emd_end_date: emdEndDate,
    auction_start_date: startDate,
    auction_end_date: endDate,
    auto_extension: autoExtension || undefined,
    bidding_template: biddingTemplate || undefined,
    bidding_access: biddingAccess || undefined,
    item_wise_time: itemWiseTime || undefined,
    items_schedule: itemsSchedule.length > 0 ? itemsSchedule : undefined,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    corrigendum_urls: corrigendumUrls.length > 0 ? corrigendumUrls : undefined,
    emd_in_favour_of: emdInFavourOf || undefined,
    inspection_date: inspectionDate || undefined,
    inspection_location: inspectionLocation || undefined,
  };
}
