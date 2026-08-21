/**
 * Indian Currency & Reserve Price Parsing Utility
 *
 * Handles Indian denomination multipliers (Lakh, Crore, Lac, Cr, etc.),
 * comma-formatted numbers, single values, and price ranges (min / max).
 */

export interface ParsedPriceRange {
  min: number | null;
  max: number | null;
  value: number | null;
}

/**
 * Parses a single numeric Indian price expression (e.g. "₹ 20.3 Lac", "1.25 Crore", "45,00,000").
 * Returns null if unparseable, empty, or invalid.
 */
function parseSingleAmount(text: string, inheritedUnit?: string): number | null {
  if (!text) return null;

  let cleaned = text.replace(/,/g, "").trim();
  if (!cleaned) return null;

  // Check if an inherited unit was passed and current text has no unit
  const hasUnit = /(?:Crore|Crores|Cr|Lakh|Lakhs|Lac|Lacs|K|Thousand)/i.test(cleaned);
  if (!hasUnit && inheritedUnit) {
    cleaned = `${cleaned} ${inheritedUnit}`;
  }

  // 1. Crore / Cr
  const croreMatch = cleaned.match(/([\d.]+)\s*(?:Crore|Crores|Cr)\b/i);
  if (croreMatch) {
    const num = parseFloat(croreMatch[1]);
    return isNaN(num) ? null : Math.round(num * 10000000);
  }

  // 2. Lac / Lakh
  const lacMatch = cleaned.match(/([\d.]+)\s*(?:Lac|Lakh|Lacs|Lakhs)\b/i);
  if (lacMatch) {
    const num = parseFloat(lacMatch[1]);
    return isNaN(num) ? null : Math.round(num * 100000);
  }

  // 3. Thousand / K
  const thousandMatch = cleaned.match(/([\d.]+)\s*(?:Thousand|K)\b/i);
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1]);
    return isNaN(num) ? null : Math.round(num * 1000);
  }

  // 4. Plain numeric amounts: e.g. "₹ 4500000", "Rs. 50,000", "50000"
  // Remove currency symbols (₹, Rs., Rs, INR) and extract number
  const withoutCurrency = cleaned
    .replace(/(?:₹|Rs\.?|INR)\s*/gi, "")
    .trim();

  const plainMatch = withoutCurrency.match(/^[\d.]+/);
  if (plainMatch) {
    const num = parseFloat(plainMatch[0]);
    return isNaN(num) ? null : Math.round(num);
  }

  return null;
}

/**
 * Parse an Indian reserve price string into a single numeric value.
 * If a range is provided, returns the lower bound (minimum) value.
 *
 * Supported formats:
 *   "₹ 20.3 Lac"             -> 2030000
 *   "₹ 1.25 Crore"           -> 12500000
 *   "Rs. 45,00,000"          -> 4500000
 *   "₹ 50,000"               -> 50000
 *   "₹10,00,000 - ₹15,00,000"-> 1000000
 *   "garbage text"           -> null
 */
export function parseIndianPrice(priceText: string | null | undefined): number | null {
  if (!priceText || typeof priceText !== "string") return null;

  const range = parseIndianPriceRange(priceText);
  return range.value;
}

/**
 * Parse Indian reserve price or price range strings into { min, max, value }.
 *
 * Supported formats:
 *   "₹10,00,000 - ₹15,00,000"     -> { min: 1000000, max: 1500000, value: 1000000 }
 *   "10 - 15 Lakh"                -> { min: 1000000, max: 1500000, value: 1000000 }
 *   "₹ 1.2 Crore to ₹ 1.5 Crore"  -> { min: 12000000, max: 15000000, value: 12000000 }
 *   "₹ 20.3 Lac"                  -> { min: 2030000, max: 2030000, value: 2030000 }
 *   "invalid / garbage"           -> { min: null, max: null, value: null }
 */
export function parseIndianPriceRange(priceText: string | null | undefined): ParsedPriceRange {
  const nullResult: ParsedPriceRange = { min: null, max: null, value: null };
  if (!priceText || typeof priceText !== "string") return nullResult;

  const trimmed = priceText.trim();
  if (!trimmed) return nullResult;

  // Check for range patterns: " - ", " – ", " — ", " to "
  const rangeDelimiterMatch = trimmed.match(/\s*(?:[-–—]|\bto\b)\s*/i);

  if (rangeDelimiterMatch && rangeDelimiterMatch.index !== undefined) {
    const rawLeft = trimmed.substring(0, rangeDelimiterMatch.index).trim();
    const rawRight = trimmed.substring(rangeDelimiterMatch.index + rangeDelimiterMatch[0].length).trim();

    // Check if right side has a unit (e.g. "Lakh", "Crore") that left side might need
    const rightUnitMatch = rawRight.match(/(?:Crore|Crores|Cr|Lakh|Lakhs|Lac|Lacs|K|Thousand)\b/i);
    const inheritedUnit = rightUnitMatch ? rightUnitMatch[0] : undefined;

    const leftVal = parseSingleAmount(rawLeft, inheritedUnit);
    const rightVal = parseSingleAmount(rawRight);

    if (leftVal !== null && rightVal !== null) {
      const min = Math.min(leftVal, rightVal);
      const max = Math.max(leftVal, rightVal);
      return { min, max, value: min };
    }

    if (leftVal !== null) {
      return { min: leftVal, max: leftVal, value: leftVal };
    }

    if (rightVal !== null) {
      return { min: rightVal, max: rightVal, value: rightVal };
    }

    return nullResult;
  }

  // Single price amount
  const singleVal = parseSingleAmount(trimmed);
  if (singleVal === null) return nullResult;

  return {
    min: singleVal,
    max: singleVal,
    value: singleVal,
  };
}

/**
 * Backward compatibility alias for parseIndianPrice
 */
export const parseReservePrice = parseIndianPrice;
