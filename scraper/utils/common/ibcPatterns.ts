/**
 * Shared Regular Expressions & Extractors for IBC / IBBI Insolvency Assets
 *
 * Consolidates all Insolvency & Bankruptcy Board of India (IBBI) and NCLT
 * regex patterns into a single canonical source of truth, preventing regex drift
 * between card-level listing extractors and full-page detail parsers.
 */

export const IBC_REGEX = {
  // Corporate Debtor / Company Name
  CORPORATE_DEBTOR: /(?:Corporate\s*Debtor|Company\s*in\s*Liquidation|Company|CD\s*Name)\s*:?\s*([^\n]{3,80})/i,

  // Corporate Identification Number (CIN) e.g., L12345MH2000PLC123456 or U12345DL1999PTC098765
  CIN: /\b([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/i,

  // Insolvency Professional Registration Number e.g., IBBI/IPA-001/IP-P00123/2017-2018/10234
  LIQUIDATOR_REG_NO: /(IBBI\/IPA-[A-Za-z0-9\/\-_]+)/i,

  // Liquidator / Resolution Professional Email Address
  LIQUIDATOR_EMAIL: /(?:(?:Liquidator|Resolution\s*Professional|RP|IP)?\s*(?:Email|Mail|Contact\s*Email)?\s*:?\s*)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,

  // NCLT Bench Jurisdiction e.g., NCLT Mumbai Bench - Court II, NCLT New Delhi Bench - Court-I
  NCLT_BENCH: /(NCLT\s+[A-Za-z\s]+?(?:Bench|Court)(?:\s*[-–]\s*(?:Court\s*[-–\s]*)?[IVX0-9A-Za-z]+)?)/i,

  // NCLT Case Number / Company Petition e.g., CP (IB) No. 123/MB/2021, CA (IB) 456/2020
  NCLT_CASE_NO: /(\b(?:CP|CA)\b\s*(?:\(IB\))?\s*(?:No\.?)?\s*[\d\/\w-]+)/i,
} as const;

export interface ExtractedIBCMetadata {
  corporateDebtorName?: string;
  corporateDebtorCin?: string;
  liquidatorRegNo?: string;
  liquidatorEmail?: string;
  ncltBench?: string;
  ncltCaseNo?: string;
}

export function extractCorporateDebtorName(text: string): string {
  if (!text) return "";
  const match = text.match(IBC_REGEX.CORPORATE_DEBTOR);
  return match ? match[1].trim() : "";
}

export function extractCorporateDebtorCin(text: string): string {
  if (!text) return "";
  const match = text.match(IBC_REGEX.CIN);
  return match ? match[1].trim().toUpperCase() : "";
}

export function extractLiquidatorRegNo(text: string): string {
  if (!text) return "";
  const match = text.match(IBC_REGEX.LIQUIDATOR_REG_NO);
  return match ? match[1].trim() : "";
}

export function extractLiquidatorEmail(text: string): string {
  if (!text) return "";
  const match = text.match(IBC_REGEX.LIQUIDATOR_EMAIL);
  return match ? match[1].trim() : "";
}

export function extractNcltBench(text: string): string {
  if (!text) return "";
  const match = text.match(IBC_REGEX.NCLT_BENCH);
  return match ? match[1].trim() : "";
}

export function extractNcltCaseNo(text: string): string {
  if (!text) return "";
  const match = text.match(IBC_REGEX.NCLT_CASE_NO);
  return match ? match[1].trim() : "";
}

/**
 * Extracts all IBC metadata fields from raw listing text or HTML document body.
 */
export function extractIBCMetadata(text: string): ExtractedIBCMetadata {
  if (!text) return {};

  const corporateDebtorName = extractCorporateDebtorName(text);
  const corporateDebtorCin = extractCorporateDebtorCin(text);
  const liquidatorRegNo = extractLiquidatorRegNo(text);
  const liquidatorEmail = extractLiquidatorEmail(text);
  const ncltBench = extractNcltBench(text);
  const ncltCaseNo = extractNcltCaseNo(text);

  return {
    ...(corporateDebtorName ? { corporateDebtorName } : {}),
    ...(corporateDebtorCin ? { corporateDebtorCin } : {}),
    ...(liquidatorRegNo ? { liquidatorRegNo } : {}),
    ...(liquidatorEmail ? { liquidatorEmail } : {}),
    ...(ncltBench ? { ncltBench } : {}),
    ...(ncltCaseNo ? { ncltCaseNo } : {}),
  };
}
