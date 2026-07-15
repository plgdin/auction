/**
 * BaankNet Listing Parser
 *
 * Extracts structured auction data from the BaankNet eAuction DOM.
 * Handles Indian currency parsing (Lakh/Crore), date formats,
 * and location decomposition.
 */
import { logger } from "../utils/logger.js";

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
}

// ─── Price Parsing ───────────────────────────────────────────────────────────

/**
 * Parse Indian currency strings into numeric INR values.
 *
 * Examples:
 *   "₹ 20.05 Lakh"  → 2005000
 *   "₹ 1.5 Crore"   → 15000000
 *   "₹ 50,000"      → 50000
 *   "₹ 2.61 Lakh"   → 261000
 */
export function parseReservePrice(priceText: string): number | null {
  if (!priceText) return null;

  const cleaned = priceText
    .replace(/₹/g, "")
    .replace(/rs\.?/gi, "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) return null;

  const croreMatch = cleaned.match(/([\d.]+)\s*cr(?:ore)?/i);
  if (croreMatch) {
    return Math.round(parseFloat(croreMatch[1]) * 10_000_000);
  }

  const lakhMatch = cleaned.match(/([\d.]+)\s*(?:lakh|lac|lacs|lakhs)/i);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100_000);
  }

  const plainMatch = cleaned.match(/^([\d.]+)$/);
  if (plainMatch) {
    return Math.round(parseFloat(plainMatch[1]));
  }

  log.warn({ priceText }, "Could not parse reserve price");
  return null;
}

// ─── Date Parsing ────────────────────────────────────────────────────────────

/**
 * Parse BaankNet date strings into ISO format.
 *
 * Input formats:
 *   "15-07-2026 14:00:00"
 *   "15/07/2026 14:00:00"
 *   "15-07-2026"
 */
export function parseBaankNetDate(dateStr: string): string | null {
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

  // DD-MM-YYYY or DD/MM/YYYY (no time)
  const dateOnlyMatch = cleaned.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return `${year}-${month}-${day}T00:00:00+05:30`;
  }

  log.warn({ dateStr }, "Could not parse BaankNet date");
  return null;
}

// ─── Property Type Classification ────────────────────────────────────────────

/**
 * Infer property type and category from the listing title.
 */
export function classifyProperty(title: string): {
  propertyType: string;
  category: string;
  subcategory: string;
} {
  const lower = (title || "").toLowerCase();

  if (/\bflat\b|\bapartment\b/.test(lower)) {
    return {
      propertyType: "Flat / Apartment",
      category: "Real Estate",
      subcategory: "Flat / Apartment",
    };
  }
  if (/\bhouse\b|\bbungalow\b|\bvilla\b|\bresidential\b/.test(lower)) {
    return {
      propertyType: "House / Bungalow",
      category: "Real Estate",
      subcategory: "House / Bungalow",
    };
  }
  if (/\bplot\b|\bland\b|\bagricultural\b/.test(lower)) {
    return {
      propertyType: "Land / Plot",
      category: "Real Estate",
      subcategory: "Land / Plot",
    };
  }
  if (/\bshop\b|\boffice\b|\bcommercial\b|\bgodown\b|\bwarehouse\b/.test(lower)) {
    return {
      propertyType: "Commercial Property",
      category: "Real Estate",
      subcategory: "Commercial Property",
    };
  }
  if (/\bcar\b|\bvehicle\b|\btruck\b|\bbus\b|\bbike\b|\btractor\b|\bjcb\b|\bmachinery\b/.test(lower)) {
    return {
      propertyType: "Vehicle / Machinery",
      category: "Vehicles & Machinery",
      subcategory: "Bank Seized Vehicle",
    };
  }
  if (/\bgold\b|\bjewel/.test(lower)) {
    return {
      propertyType: "Gold / Jewellery",
      category: "Precious Assets",
      subcategory: "Gold / Jewellery",
    };
  }
  if (/\bindustrial\b|\bfactory\b|\bplant\b/.test(lower)) {
    return {
      propertyType: "Industrial Property",
      category: "Real Estate",
      subcategory: "Industrial Property",
    };
  }

  return {
    propertyType: "Other",
    category: "Real Estate",
    subcategory: "Bank Property",
  };
}

// ─── Location Parsing ────────────────────────────────────────────────────────

/**
 * Parse location string from BaankNet format.
 * Example: "Rajasthan, Dausa, Dausa-303303"
 *       → { state: "Rajasthan", city: "Dausa", pincode: "303303" }
 */
export function parseLocation(locationStr: string): {
  state: string;
  city: string;
  pincode: string;
} {
  if (!locationStr) {
    return { state: "", city: "", pincode: "" };
  }

  const parts = locationStr.split(",").map((p) => p.trim());

  const state = parts[0] || "";
  let city = parts[1] || "";
  let pincode = "";

  // Extract pincode from last part (e.g., "Dausa-303303" or "Mumbai-400001")
  const lastPart = parts[parts.length - 1] || "";
  const pincodeMatch = lastPart.match(/(\d{6})/);
  if (pincodeMatch) {
    pincode = pincodeMatch[1];
  }

  // If city still has pincode appended, clean it
  if (city.includes("-") && /\d{6}/.test(city)) {
    city = city.replace(/-?\d{6}/, "").trim();
  }

  return { state, city, pincode };
}

// ─── Main DOM Extraction ─────────────────────────────────────────────────────

/**
 * Extract structured listing data from raw DOM-scraped records.
 *
 * This function takes the raw data objects produced by Puppeteer's
 * page.evaluate() and maps them into clean BaankNetListing objects
 * ready for database insertion.
 */
export function parseListings(
  rawItems: RawBaankNetItem[],
  statusFilter: string
): BaankNetListing[] {
  const parsed: BaankNetListing[] = [];

  for (const item of rawItems) {
    if (!item.auctionId) {
      log.warn({ item }, "Skipping item with no auction ID");
      continue;
    }

    const priceValue = parseReservePrice(item.reservePrice);
    const startDate = parseBaankNetDate(item.startDate);
    const endDate = parseBaankNetDate(item.endDate);

    if (!startDate || !endDate) {
      log.warn(
        { auctionId: item.auctionId, startDate: item.startDate, endDate: item.endDate },
        "Skipping item with unparsable dates"
      );
      continue;
    }

    const { state, city, pincode } = parseLocation(item.location);
    const { propertyType, category, subcategory } = classifyProperty(item.title);

    parsed.push({
      baanknet_auction_id: item.auctionId,
      bank_property_id: item.bankPropertyId || "",
      title: item.title || "Untitled Bank Auction",
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
      source_url: `https://baanknet.com/eAuction/auction-detail/${item.auctionId}`,
      category_name: `${category} | ${subcategory}`,
      raw_description: [
        item.title,
        item.reservePrice,
        item.bankName,
        item.location,
        item.address,
      ]
        .filter(Boolean)
        .join(" | "),
    });
  }

  log.info(
    { total: rawItems.length, parsed: parsed.length },
    "BaankNet listing parse complete"
  );
  return parsed;
}

// ─── Raw Item Interface (matches Puppeteer DOM extraction) ───────────────────

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
}
