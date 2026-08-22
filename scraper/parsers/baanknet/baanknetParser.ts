/**
 * BaankNet Listing Parser
 *
 * Extracts structured auction data from the BaankNet eAuction DOM.
 * Handles Indian currency parsing (Lakh/Crore), date formats,
 * and location decomposition.
 */
import { logger } from "../../utils/common/logger.js";

const log = logger.child({ module: "baanknetParser" });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BaankNetListing {
  baanknet_auction_id: string;
  bank_property_id: string;
  title: string;
  property_type: string;
  reserve_price_text: string;
  reserve_price_value: number | null;
  bank_name: string;
  state: string;
  city: string;
  pincode: string;
  full_address: string;
  location: string;
  auction_start_date: string;
  auction_end_date: string;
  auction_status: string;
  source_url: string;
  category_name: string;
  raw_description: string;
  document_url?: string;

  // Multi-module fields
  auction_module: string;
  carpet_area?: string;
  carpet_area_sqft?: number | null;
  furnishing?: string;
  possession_status?: string;
  action_type?: string;
  district?: string;
  inspection_start_date?: string | null;
  inspection_end_date?: string | null;
  emd_end_date?: string | null;
  borrower_name?: string;
  borrower_names?: string[];
  property_description?: string;
  photo_count?: number;
  thumbnail_url?: string;
  photo_urls?: string[];
  document_urls?: string[];
  emd_amount_text?: string;
  emd_amount_value?: number | null;
  bid_increment_text?: string;
  bid_increment_amount?: number | null;
  emd_account_number?: string;
  emd_account_ifsc?: string;
  emd_bank_name?: string;
  outstanding_dues_text?: string;
  outstanding_dues_value?: number | null;
  tender_fee_text?: string;
  tender_fee_value?: number | null;
  cersai_id?: string;
  title_type?: string;
  encumbrances_text?: string;
  branch_name?: string;
  officer_designation?: string;
  officer_email?: string;
  contact_person?: string;
  contact_phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  map_url?: string;
  boundaries?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  corporate_debtor_name?: string;
  corporate_debtor_cin?: string;
  liquidator_reg_no?: string;
  liquidator_email?: string;
  nclt_bench?: string;
  nclt_case_no?: string;
  process_memo_url?: string;
  extracted_pdf_text?: string;
  dedup_fingerprint?: string;
}

// ─── Price Parser ───────────────────────────────────────────────────────────

import {
  parseIndianPrice,
  parseIndianPriceRange,
  type ParsedPriceRange,
} from "../../utils/common/priceParser.js";

export {
  parseIndianPrice,
  parseIndianPriceRange,
  type ParsedPriceRange,
};

// ─── Date Parser ────────────────────────────────────────────────────────────

/**
 * Parse BaankNet date strings into ISO format.
 *
 * Supported formats:
 *   "31-08-2026 10:30:00"  -> "2026-08-31T10:30:00+05:30"
 *   "31-08-2026 10:30"     -> "2026-08-31T10:30:00+05:30"
 *   "31/08/2026"           -> "2026-08-31T00:00:00+05:30"
 *   "31-08-2026"           -> "2026-08-31T00:00:00+05:30"
 */
export function parseBaanknetDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
  const fullMatch = cleaned.match(
    /(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
  );
  if (fullMatch) {
    const [, day, month, year, hours, minutes, seconds] = fullMatch;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
  }

  // DD-MM-YYYY HH:mm or DD/MM/YYYY HH:mm
  const noSecMatch = cleaned.match(
    /(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{2}):(\d{2})/
  );
  if (noSecMatch) {
    const [, day, month, year, hours, minutes] = noSecMatch;
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

  log.warn({ dateStr }, "Could not parse BaankNet date");
  return null;
}

// ─── Location Parser ─────────────────────────────────────────────────────────

function isBankOrGarbageLocation(str: string): boolean {
  if (!str || str.length < 2) return true;
  const lower = str.toLowerCase().trim();
  return (
    lower.includes("bank") ||
    lower.includes("lender") ||
    lower.includes("finance") ||
    lower.includes("financial") ||
    lower.includes("arc") ||
    lower.includes("nbfc") ||
    lower.includes("corporation") ||
    lower.includes("showing") ||
    lower.includes("result") ||
    lower.includes("details") ||
    lower.includes("property id") ||
    lower.includes("auction id")
  );
}

/**
 * Decompose a location string into state, city, pincode, and location label.
 *
 * Examples:
 *   "Gujarat, Amboli"        -> { state: "Gujarat", city: "Amboli", location: "Gujarat" }
 *   "Maharashtra, Mumbai - 400001" -> { state: "Maharashtra", city: "Mumbai", pincode: "400001" }
 */
export function parseBaanknetLocation(locStr: string): {
  state: string;
  city: string;
  pincode: string;
  location: string;
} {
  if (!locStr) {
    return { state: "", city: "", pincode: "", location: "India" };
  }

  let cleanLoc = locStr.trim();
  let pincode = "";

  // Extract pincode (6-digit number)
  const pinMatch = cleanLoc.match(/\b(\d{6})\b/);
  if (pinMatch) {
    pincode = pinMatch[1];
    cleanLoc = cleanLoc.replace(/\b\d{6}\b/, "").replace(/-\s*$/, "").trim();
  }

  const parts = cleanLoc
    .split(/[,–-]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !isBankOrGarbageLocation(p));

  if (parts.length >= 2) {
    return {
      state: parts[0],
      city: parts[1],
      pincode,
      location: parts[0] || "India",
    };
  }

  const single = parts[0] || "";
  return {
    state: single,
    city: single,
    pincode,
    location: single || "India",
  };
}

// ─── Property Type Parser ────────────────────────────────────────────────────

/**
 * Extract and normalize property type from title or description.
 *
 * Mappings:
 *   House/Bungalow, Flat/Apartment, Commercial Plot, Land, Vehicle, Machinery, etc.
 */
export function parsePropertyType(title: string): {
  propertyType: string;
  category: string;
  subcategory: string;
} {
  const lower = (title || "").toLowerCase();

  if (lower.includes("car") || lower.includes("alto") || lower.includes("altroz") || lower.includes("sedan") || lower.includes("hatchback") || lower.includes("swift") || lower.includes("creta") || lower.includes("four wheeler")) {
    return { propertyType: "Four Wheeler / Car", category: "Vehicles", subcategory: "Cars & Automobiles" };
  }
  if (lower.includes("bike") || lower.includes("motorcycle") || lower.includes("scooter") || lower.includes("two wheeler") || lower.includes("royal enfield")) {
    return { propertyType: "Two Wheeler / Bike", category: "Vehicles", subcategory: "Motorcycles & Two Wheelers" };
  }
  if (lower.includes("truck") || lower.includes("blazo") || lower.includes("leyland") || lower.includes("avtr") || lower.includes("bharatbenz") || lower.includes("1212 lpt") || lower.includes("trailer") || lower.includes("tipper")) {
    return { propertyType: "Commercial / Truck", category: "Vehicles", subcategory: "Commercial Vehicles & Trucks" };
  }
  if (lower.includes("bus") || lower.includes("coach")) {
    return { propertyType: "Commercial / Bus", category: "Vehicles", subcategory: "Buses & Passenger Transport" };
  }
  if (lower.includes("tractor")) {
    return { propertyType: "Tractor / Agricultural", category: "Vehicles", subcategory: "Tractors & Farm Equipment" };
  }
  if (lower.includes("vehicle") || lower.includes("automobile")) {
    return { propertyType: "Vehicle", category: "Vehicles", subcategory: "Automobiles" };
  }

  if (lower.includes("house") || lower.includes("bungalow") || lower.includes("villa") || lower.includes("residential house")) {
    return { propertyType: "House / Bungalow", category: "Real Estate", subcategory: "House / Bungalow" };
  }
  if (lower.includes("flat") || lower.includes("apartment") || lower.includes("residential unit")) {
    return { propertyType: "Flat / Apartment", category: "Real Estate", subcategory: "Flat / Apartment" };
  }
  if (lower.includes("commercial") || lower.includes("office") || lower.includes("shop") || lower.includes("godown") || lower.includes("showroom")) {
    return { propertyType: "Commercial Building", category: "Real Estate", subcategory: "Commercial Building" };
  }
  if (lower.includes("plot") || lower.includes("land") || lower.includes("site") || lower.includes("open land")) {
    return { propertyType: "Land / Plot", category: "Real Estate", subcategory: "Land / Plot" };
  }
  if (lower.includes("machinery") || lower.includes("plant") || lower.includes("equipment")) {
    return { propertyType: "Plant & Machinery", category: "Industrial", subcategory: "Plant & Machinery" };
  }

  return { propertyType: "Bank Foreclosure Property", category: "Real Estate", subcategory: "Bank Foreclosure Property" };
}

// ─── Carpet Area Parser ──────────────────────────────────────────────────────

export function parseCarpetArea(text: string): { raw: string; sqft: number | null } {
  if (!text) return { raw: "", sqft: null };

  const match = text.match(/([\d,.]+)\s*(sq\.?\s*(?:ft|feet|meter|metre|mtr)|sqft|sqm)/i);
  if (!match) return { raw: "", sqft: null };

  const num = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(num)) return { raw: match[0], sqft: null };

  const unit = match[2].toLowerCase();
  let sqft = num;
  if (unit.includes("meter") || unit.includes("metre") || unit.includes("sqm")) {
    sqft = Math.round(num * 10.7639);
  } else {
    sqft = Math.round(num);
  }

  return { raw: `${num} ${match[2]}`, sqft };
}

// ─── Deduplication Fingerprint Computation ────────────────────────────────────

export function computeDedupFingerprint(fields: {
  bank_property_id: string;
  pincode: string;
  reserve_price_value: number | null;
  auction_start_date: string;
}): string {
  const parts = [
    fields.bank_property_id ? `bpid:${fields.bank_property_id}` : "",
    fields.pincode ? `pin:${fields.pincode}` : "",
    fields.reserve_price_value ? `price:${fields.reserve_price_value}` : "",
    fields.auction_start_date ? `date:${fields.auction_start_date.split("T")[0]}` : "",
  ].filter(Boolean);

  return parts.join("|") || `random:${Math.random().toString(36).substring(2, 10)}`;
}

// ─── Main Batch Parser ───────────────────────────────────────────────────────

/**
 * Raw DOM item extracted from BaankNet DOM cards/tables.
 */
export interface RawBaankNetItem {
  auctionId: string;
  bankPropertyId: string;
  title: string;
  reservePrice: string;
  bankName: string;
  location: string;
  address: string;
  startDate: string;
  endDate: string;
  detailUrl?: string;
  auctionModule?: string;
  carpetArea?: string;
  furnishing?: string;
  possessionStatus?: string;
  actionType?: string;
  district?: string;
  inspectionStartDate?: string;
  inspectionEndDate?: string;
  emdEndDate?: string;
  borrowerName?: string;
  borrowerNames?: string[];
  description?: string;
  thumbnailUrl?: string;
  photoUrls?: string[];
  documentUrl?: string;
  documentUrls?: string[];
  emdAmountText?: string;
  emdAmountValue?: number | null;
  bidIncrementText?: string;
  bidIncrementAmount?: number | null;
  emdAccountNumber?: string;
  emdAccountIfsc?: string;
  emdBankName?: string;
  outstandingDuesText?: string;
  outstandingDuesValue?: number | null;
  tenderFeeText?: string;
  tenderFeeValue?: number | null;
  cersaiId?: string;
  titleType?: string;
  encumbrancesText?: string;
  branchName?: string;
  officerDesignation?: string;
  officerEmail?: string;
  contactPerson?: string;
  contactPhone?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string;
  boundaries?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  corporateDebtorName?: string;
  corporateDebtorCin?: string;
  liquidatorRegNo?: string;
  liquidatorEmail?: string;
  ncltBench?: string;
  ncltCaseNo?: string;
  processMemoUrl?: string;
  extractedPdfText?: string;
}

/**
 * Parse an array of raw DOM items into validated, schema-compliant database listings.
 */
export function parseListings(
  items: RawBaankNetItem[],
  statusFilter: string = "upcoming"
): BaankNetListing[] {
  const results: BaankNetListing[] = [];

  for (const item of items) {
    if (!item.auctionId && !item.bankPropertyId) continue;

    const priceValue = parseIndianPrice(item.reservePrice);
    const emdValue = item.emdAmountValue !== undefined && item.emdAmountValue !== null
      ? item.emdAmountValue
      : (item.emdAmountText ? parseIndianPrice(item.emdAmountText) : null);
    const bidIncValue = item.bidIncrementAmount !== undefined && item.bidIncrementAmount !== null
      ? item.bidIncrementAmount
      : (item.bidIncrementText ? parseIndianPrice(item.bidIncrementText) : null);
    const duesValue = item.outstandingDuesValue !== undefined && item.outstandingDuesValue !== null
      ? item.outstandingDuesValue
      : (item.outstandingDuesText ? parseIndianPrice(item.outstandingDuesText) : null);
    const tenderFeeValue = item.tenderFeeValue !== undefined && item.tenderFeeValue !== null
      ? item.tenderFeeValue
      : (item.tenderFeeText ? parseIndianPrice(item.tenderFeeText) : null);

    const startDate = parseBaanknetDate(item.startDate) || new Date().toISOString();
    const endDate = parseBaanknetDate(item.endDate) || new Date(Date.now() + 30 * 86400000).toISOString();
    const { state, city, pincode, location } = parseBaanknetLocation(item.location || item.address);
    const { propertyType, category, subcategory } = parsePropertyType(item.title || item.description || "");
    const areaInfo = parseCarpetArea(item.carpetArea || item.description || "");

    const inspStart = item.inspectionStartDate ? parseBaanknetDate(item.inspectionStartDate) : null;
    const inspEnd = item.inspectionEndDate ? parseBaanknetDate(item.inspectionEndDate) : null;
    const emdEnd = item.emdEndDate ? parseBaanknetDate(item.emdEndDate) : null;

    let cleanTitle = (item.title || "").trim();
    if (
      !cleanTitle ||
      cleanTitle.toLowerCase().startsWith("showing") ||
      cleanTitle.toLowerCase().includes("10000+") ||
      cleanTitle.toLowerCase().includes("results found") ||
      cleanTitle.toLowerCase().includes("properties found") ||
      cleanTitle.toLowerCase().includes("search results") ||
      cleanTitle === "Bank Auction Property"
    ) {
      const areaPrefix = areaInfo.raw ? `${areaInfo.raw} ` : (item.carpetArea ? `${item.carpetArea} ` : "");
      const pType = propertyType && propertyType !== "Bank Foreclosure Property" ? propertyType : "Bank Foreclosure Property";
      const locSuffix = city && !city.toLowerCase().includes("bank")
        ? ` in ${city}`
        : (state && !state.toLowerCase().includes("bank") ? ` in ${state}` : "");
      cleanTitle = `${areaPrefix}${pType}${locSuffix}` || "Bank Foreclosure Property";
    }

    results.push({
      baanknet_auction_id: item.auctionId || item.bankPropertyId,
      bank_property_id: item.bankPropertyId || item.auctionId,
      title: cleanTitle,
      property_type: propertyType,
      reserve_price_text: item.reservePrice || "",
      reserve_price_value: priceValue,
      bank_name: item.bankName || "Unknown Bank",
      state,
      city,
      pincode,
      full_address: item.address || "",
      location: state || "India",
      auction_start_date: startDate,
      auction_end_date: endDate,
      auction_status: statusFilter,
      source_url: item.detailUrl
        ? (item.detailUrl.startsWith("http://baanknet.com")
            ? item.detailUrl.replace("http://baanknet.com", "https://baanknet.com")
            : item.detailUrl.startsWith("http")
            ? item.detailUrl
            : `https://baanknet.com${item.detailUrl.startsWith("/") ? "" : "/"}${item.detailUrl}`)
        : `https://baanknet.com/eauction-psb/home`,
      category_name: `${category} | ${subcategory}`,
      raw_description: [
        item.title,
        item.reservePrice,
        item.bankName,
        item.location,
        item.address,
        item.carpetArea,
        item.actionType,
      ]
        .filter(Boolean)
        .join(" | "),
      document_url: item.documentUrl || undefined,

      // Multi-module fields
      auction_module: item.auctionModule || "eauction_psb",
      carpet_area: areaInfo.raw,
      carpet_area_sqft: areaInfo.sqft,
      furnishing: item.furnishing,
      possession_status: item.possessionStatus,
      action_type: item.actionType,
      district: item.district || undefined,
      inspection_start_date: inspStart,
      inspection_end_date: inspEnd,
      emd_end_date: emdEnd,
      borrower_name: item.borrowerName,
      borrower_names: item.borrowerNames,
      property_description: item.description,
      photo_count: item.photoUrls?.length || 0,
      thumbnail_url: item.thumbnailUrl || (item.photoUrls && item.photoUrls.length > 0 ? item.photoUrls[0] : undefined),
      photo_urls: item.photoUrls,
      document_urls: item.documentUrls,
      emd_amount_text: item.emdAmountText,
      emd_amount_value: emdValue,
      bid_increment_text: item.bidIncrementText,
      bid_increment_amount: bidIncValue,
      emd_account_number: item.emdAccountNumber,
      emd_account_ifsc: item.emdAccountIfsc,
      emd_bank_name: item.emdBankName,
      outstanding_dues_text: item.outstandingDuesText,
      outstanding_dues_value: duesValue,
      tender_fee_text: item.tenderFeeText,
      tender_fee_value: tenderFeeValue,
      cersai_id: item.cersaiId,
      title_type: item.titleType,
      encumbrances_text: item.encumbrancesText,
      branch_name: item.branchName,
      officer_designation: item.officerDesignation,
      officer_email: item.officerEmail,
      contact_person: item.contactPerson,
      contact_phone: item.contactPhone,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      map_url: item.mapUrl,
      boundaries: item.boundaries,
      corporate_debtor_name: item.corporateDebtorName,
      corporate_debtor_cin: item.corporateDebtorCin,
      liquidator_reg_no: item.liquidatorRegNo,
      liquidator_email: item.liquidatorEmail,
      nclt_bench: item.ncltBench,
      nclt_case_no: item.ncltCaseNo,
      process_memo_url: item.processMemoUrl,
      extracted_pdf_text: item.extractedPdfText,
      dedup_fingerprint: computeDedupFingerprint({
        bank_property_id: item.bankPropertyId || "",
        pincode,
        reserve_price_value: priceValue,
        auction_start_date: startDate,
      }),
    });
  }

  return results;
}

export { parseBaanknetLocation as parseLocation };

