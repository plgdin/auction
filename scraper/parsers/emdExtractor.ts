/**
 * EMD (Earnest Money Deposit) extractor for MSTC catalog PDFs.
 *
 * Extracts deposit details: Post-Bid EMD percentage, Pre-Bid EMD amounts,
 * and admin/service charges from catalog text.
 *
 * Fixes applied:
 * - Isolated from the main parser for single responsibility.
 * - Prevents false numeric captures from unrelated fields.
 */
import { ADMIN_CHARGES } from "../config.js";
import type { DepositDetails } from "./types.js";

/**
 * Extract deposit and EMD details from catalog text.
 *
 * @param cleanText - The normalized catalog text (lines joined by \n).
 * @returns Structured deposit details.
 */
export function extractDepositDetails(cleanText: string, isCustoms = false): DepositDetails {
  let emdValue = "Refer to Catalog / Lot Details";
  let preBidDdg = "Refer to Catalog / Lot Details";

  // ── 1. Try Post-Bid EMD percentage (e.g. "Post Bid EMD % - 25.0") ────────
  const emdPercentMatch =
    cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*\n*([\d.]+)/i) ||
    cleanText.match(/Post\s*Bid\s*EMD\s*%\s*-\s*([\d.]+)/i);

  if (emdPercentMatch) {
    emdValue = `${emdPercentMatch[1]}% of total bid value (Post-Bid EMD)`;
  } else {
    // ── 2. Fallback: Pre-Bid EMD ────────────────────────────────────────────
    const preBidMatch = cleanText.match(/Pre-Bid EMD:\s*([^\n]+)/i);
    if (preBidMatch) {
      const matchVal = preBidMatch[1].trim();
      if (
        !matchVal.toLowerCase().includes("not a auto") &&
        !matchVal.toLowerCase().includes("item wise")
      ) {
        const numOnly = matchVal.replace(/[^\d]/g, "");
        const parsedNum = parseInt(numOnly, 10);
        if (numOnly && parsedNum > 100) {
          preBidDdg = `₹${parsedNum.toLocaleString("en-IN")}`;
          emdValue = "Refer to Catalog / Lot Details";
        } else {
          preBidDdg = matchVal;
        }
      }
    }
  }

  // ── 3. Explicit Pre-Bid EMD Amount ────────────────────────────────────────
  const allPreBidsMatches = cleanText.match(
    /(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]+)/gi
  );
  let isLotWise = false;
  if (allPreBidsMatches && allPreBidsMatches.length > 1) {
    const uniqueValues = new Set<string>();
    allPreBidsMatches.forEach((m) => {
      const numMatch = m.match(/([\d,]+)$/);
      if (numMatch) {
        uniqueValues.add(numMatch[1].replace(/,/g, ""));
      }
    });
    if (uniqueValues.size > 1) {
      isLotWise = true;
    }
  }

  if (isLotWise) {
    preBidDdg = "Lot-wise (Refer to Lot Details)";
  } else {
    const explicitPreBidMatch = cleanText.match(
      /(?:Pre-Bid\s*(?:EMD\s*)?Amount|Pre-Bid\s*Amount)[\s\S]{0,50}?(?:Rs\.?|₹)?\s*([\d,]{4,10})/i,
    );
    if (explicitPreBidMatch) {
      const val = explicitPreBidMatch[1].replace(/,/g, "");
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 100) {
        preBidDdg = `₹${num.toLocaleString("en-IN")}`;
      }
    }
  }

  // Check for MSME exemption text in cleanText (only if not a Customs auction)
  const isCustomsFinal = isCustoms || /customs/i.test(cleanText);
  const hasMsmeExemption = !isCustomsFinal &&
                           /msme|micro\s*,?\s*small/i.test(cleanText) && 
                           /(?:exempt|not\s+required|no\s+pre-bid|nil)/i.test(cleanText);

  if (hasMsmeExemption) {
    if (preBidDdg && preBidDdg !== "Refer to Catalog / Lot Details") {
      if (!preBidDdg.includes("MSME")) {
        preBidDdg = `${preBidDdg} (Not required for registered MSME bidders)`;
      }
    } else {
      preBidDdg = "Not required for registered MSME bidders";
    }
  }

  return {
    emd: emdValue,
    preBidDdg,
    adminCharges: ADMIN_CHARGES,
  };
}
