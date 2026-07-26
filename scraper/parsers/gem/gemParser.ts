/**
 * GeM Portal Listing Parser
 *
 * Extracts structured auction data from the GeM Forward Auction listing DOM.
 */
import { mapCategory } from "../../utils/common/categoryMapper.js";
import { logger } from "../../utils/common/logger.js";

const log = logger.child({ module: "gemParser" });

export interface GeMListing {
  gem_auction_id: string;
  title: string;
  reserve_price_text?: string;
  reserve_price_value?: number | null;
  ministry?: string;
  department?: string;
  organisation?: string;
  state?: string;
  city?: string;
  pincode?: string;
  full_address?: string;
  location: string;
  auction_start_date: string;
  auction_end_date: string;
  auction_status: string;
  source_url: string;
  document_url?: string;
  category_name: string;
  raw_description?: string;
}

// ─── Price Parser ───────────────────────────────────────────────────────────

/**
 * Parse reserve price text into numeric values.
 */
export function parseReservePrice(priceText: string): number | null {
  if (!priceText) return null;

  const cleaned = priceText
    .replace(/[^0-9.]/g, "")
    .trim();

  if (!cleaned) return null;

  try {
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
  } catch (e) {
    return null;
  }
}

// ─── Date Parser ────────────────────────────────────────────────────────────

/**
 * Parse GeM Portal date strings into ISO format.
 *
 * Supported formats:
 *   "25-07-2026 14:00:00"
 *   "25/07/2026 14:00:00"
 *   "25-07-2026"
 */
export function parseGeMDate(dateStr: string): string | null {
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
 *
 * Example:
 *   "Kokrajhar - Kokrajhar - ASSAM - 783370"
 */
export function parseGeMLocation(locStr: string): {
  state: string;
  city: string;
  pincode: string;
  location: string;
} {
  if (!locStr) {
    return { state: "", city: "", pincode: "", location: "India" };
  }

  const parts = locStr.split("-").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 4) {
    return {
      city: parts[0],
      state: parts[2],
      pincode: parts[3],
      location: parts[2] || "India",
    };
  }

  if (parts.length === 3) {
    // City - State - Pincode
    return {
      city: parts[0],
      state: parts[1],
      pincode: parts[2],
      location: parts[1] || "India",
    };
  }

  if (parts.length === 2) {
    // City - State
    return {
      city: parts[0],
      state: parts[1],
      pincode: "",
      location: parts[1] || "India",
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
      location: "India",
    };
  }

  return {
    city: single,
    state: "",
    pincode: "",
    location: single || "India",
  };
}

// ─── Category Classification ──────────────────────────────────────────────────

/**
 * Classify a listing based on title and mapping dictionaries.
 */
export function classifyGeMListing(title: string): string {
  const result = mapCategory(title);
  return `${result.category} | ${result.subcategory}`;
}

export { parseGeMLocation as parseLocation };

