/**
 * EMD (Earnest Money Deposit) extractor for MSTC catalog PDFs.
 */
import { ADMIN_CHARGES } from "../../config.js";
import type { DepositDetails } from "../types.js";

export function extractDepositDetails(cleanText: string, isCustoms = false): DepositDetails {
  let postBidEmdPercent = isCustoms ? 25 : 10;
  const adminChargesStr = ADMIN_CHARGES;

  const emdPercentMatch = cleanText.match(
    /(?:EMD|Earnest\s*Money)\s*[:\-–]?\s*(\d{1,2})\s*%/i
  );
  if (emdPercentMatch) {
    const val = parseInt(emdPercentMatch[1], 10);
    if (val >= 1 && val <= 50) {
      postBidEmdPercent = val;
    }
  }

  let preBidEmdAmount: string | undefined;
  const preBidMatch = cleanText.match(
    /(?:Pre[\s-]*Bid\s*EMD|Pre-Bid\s*Deposit)\s*[:\-–]?\s*(Rs\.?|INR|₹)?\s*([\d,.]+)/i
  );
  if (preBidMatch) {
    preBidEmdAmount = `Rs. ${preBidMatch[2]}`;
  }

  return {
    emd: `${postBidEmdPercent}% of bid value`,
    preBidDdg: preBidEmdAmount || "Not specified / as per STC",
    adminCharges: adminChargesStr,
    postBidEmdPercent,
    preBidEmdAmount,
    preBidEmdRequired: !!preBidEmdAmount,
  };
}
