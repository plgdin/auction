/**
 * GeM Portal Bids/Tenders Parser
 *
 * Extracts and normalizes structured properties from GeM BidPlus listings.
 */
import { mapCategory } from "../../utils/common/categoryMapper.js";
import { logger } from "../../utils/common/logger.js";

const log = logger.child({ module: "gemBidParser" });

export interface GeMBid {
  bid_number: string;
  ra_number?: string | null;
  items: string;
  quantity?: string | null;
  department_name?: string | null;
  start_date: string;
  end_date: string;
  status: string;
  document_url?: string | null;
  ra_document_url?: string | null;
  category_name: string;
  raw_description?: string | null;
}

/**
 * Parse GeM Bid date strings (e.g., "24-07-2026 11:00 AM" or "25-07-2026 1:50 PM") into ISO standard format.
 */
export function parseGeMBidDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Pattern: DD-MM-YYYY hh:mm AM/PM or DD/MM/YYYY hh:mm AM/PM
  const ampmMatch = cleaned.match(
    /(\d{2})[-/](\d{2})[-/](\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (ampmMatch) {
    const [, day, month, year, hoursStr, minutes, meridian] = ampmMatch;
    let hours = parseInt(hoursStr, 10);
    const isPm = meridian.toUpperCase() === "PM";
    
    if (isPm && hours < 12) {
      hours += 12;
    } else if (!isPm && hours === 12) {
      hours = 0;
    }

    const formattedHours = hours.toString().padStart(2, "0");
    return `${year}-${month}-${day}T${formattedHours}:${minutes}:00+05:30`;
  }

  // Fallback: Check if it's already ISO or native Date parses it
  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {
    // Ignore error
  }

  log.warn({ dateStr }, "Failed to parse GeM Bid date");
  return null;
}

/**
 * Classify a procurement item based on title.
 */
export function classifyGeMBid(title: string): string {
  const result = mapCategory(title);
  return `${result.category} | ${result.subcategory}`;
}
