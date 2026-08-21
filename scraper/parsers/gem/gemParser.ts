/**
 * GeM Portal Listing Parser
 *
 * Extracts structured auction data from the GeM Forward Auction listing DOM.
 */
import { mapCategory } from "../../utils/common/categoryMapper.js";
import { logger } from "../../utils/common/logger.js";
import {
  parseIndianPrice,
  parseIndianPriceRange,
  type ParsedPriceRange,
} from "../../utils/common/priceParser.js";

const log = logger.child({ module: "gemParser" });

export interface GeMListing {
  gem_auction_id: string;
  title: string;
  reserve_price_text?: string;
  reserve_price_value?: number | null;
  reserve_price_value_min?: number | null;
  reserve_price_value_max?: number | null;
  ministry?: string;
  department?: string;
  organisation?: string;
  state?: string;
  city?: string;
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
  document_url?: string;
  document_urls?: string[];
  category_name: string;
  raw_description?: string;
}

export interface ParsedGeMLocation {
  state: string;
  city: string;
  pincode: string;
  location: string;
  location_unparsed: boolean;
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

// ─── Category Classification ──────────────────────────────────────────────────

/**
 * Classify a listing based on title and mapping dictionaries.
 */
export function classifyGeMListing(title: string): string {
  const result = mapCategory(title);
  return `${result.category} | ${result.subcategory}`;
}

export { parseGeMLocation as parseLocation };
