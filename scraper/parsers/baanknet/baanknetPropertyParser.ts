/**
 * BaankNet Property Parser
 *
 * Extracts structured property intelligence from BaankNet PDF text content.
 * Mirrors the MSTC mstcParser + contactExtractor + emdExtractor pattern.
 *
 * Extracts:
 *   - Property type classification (residential/commercial/industrial/land/vehicle)
 *   - Area measurements with unit normalization (sq.ft.)
 *   - SARFAESI details (section invoked, possession status)
 *   - Valuation details (valuer name, date, market/distress value)
 *   - Contact extraction (authorized officer name, phone, email, branch)
 *   - EMD bank account details (account no, IFSC, bank name)
 */

import { logger } from "../../utils/common/logger.js";

const log = logger.child({ module: "baanknetPropertyParser" });

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedPropertyIntelligence {
  propertyClassification: string | null;
  carpetAreaSqft: number | null;
  builtUpAreaSqft: number | null;
  landAreaSqft: number | null;
  areaRawText: string | null;
  sarfaesiSection: string | null;
  possessionType: string | null;
  possessionDate: string | null;
  valuationAmount: number | null;
  distressValue: number | null;
  valuerName: string | null;
  valuationDate: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactBranch: string | null;
  emdAccountNumber: string | null;
  emdAccountIfsc: string | null;
  emdBankName: string | null;
  surveyNumber: string | null;
  encumbranceSummary: string | null;
}

// ─── Area Parsing ───────────────────────────────────────────────────────────

const SQ_METER_TO_SQFT = 10.7639;
const SQ_YARD_TO_SQFT = 9.0;
const ACRE_TO_SQFT = 43560;
const HECTARE_TO_SQFT = 107639;
const BIGHA_TO_SQFT = 27000; // Approximate average

/**
 * Extract area measurement from text and normalize to square feet.
 */
function parseAreaToSqft(text: string): { sqft: number | null; raw: string | null } {
  const areaPatterns = [
    // "1200 sq.ft." / "1200 sqft" / "1,200 sq ft"
    /(\d[\d,.]*)\s*(?:sq\.?\s*(?:feet|ft)|sqft)/i,
    // "120 sq.m." / "120 sqm" / "120 sq meters"
    /(\d[\d,.]*)\s*(?:sq\.?\s*(?:meter|metre|mtr|m)|sqm)/i,
    // "150 sq.yards" / "150 sqyd"
    /(\d[\d,.]*)\s*(?:sq\.?\s*(?:yard|yd)|sqyd)/i,
    // "2 acres" / "2.5 acre"
    /(\d[\d,.]*)\s*acres?/i,
    // "1 hectare" / "1.5 hectares"
    /(\d[\d,.]*)\s*hectares?/i,
    // "3 bigha"
    /(\d[\d,.]*)\s*bighas?/i,
  ];

  for (let i = 0; i < areaPatterns.length; i++) {
    const match = text.match(areaPatterns[i]);
    if (match) {
      const rawValue = parseFloat(match[1].replace(/,/g, ""));
      if (isNaN(rawValue) || rawValue <= 0) continue;

      let sqft: number;
      switch (i) {
        case 0: sqft = rawValue; break; // already sqft
        case 1: sqft = rawValue * SQ_METER_TO_SQFT; break;
        case 2: sqft = rawValue * SQ_YARD_TO_SQFT; break;
        case 3: sqft = rawValue * ACRE_TO_SQFT; break;
        case 4: sqft = rawValue * HECTARE_TO_SQFT; break;
        case 5: sqft = rawValue * BIGHA_TO_SQFT; break;
        default: sqft = rawValue;
      }

      return { sqft: Math.round(sqft * 100) / 100, raw: match[0].trim() };
    }
  }

  return { sqft: null, raw: null };
}

// ─── Property Type Classification ───────────────────────────────────────────

function classifyPropertyType(text: string): string | null {
  const lower = text.toLowerCase();

  const residentialKeywords = [
    "residential", "flat", "apartment", "house", "bungalow", "villa",
    "duplex", "penthouse", "row house", "dwelling", "bhk",
  ];
  const commercialKeywords = [
    "commercial", "shop", "office", "showroom", "mall", "plaza",
    "complex", "retail", "warehouse", "godown",
  ];
  const industrialKeywords = [
    "industrial", "factory", "plant", "unit", "shed", "workshop",
    "manufacturing",
  ];
  const landKeywords = [
    "land", "plot", "agricultural", "farm", "khasra", "mouza",
    "survey no", "open land", "vacant land",
  ];
  const vehicleKeywords = [
    "vehicle", "car", "truck", "bus", "two wheeler", "motorcycle",
    "scooter", "tractor", "jcb", "crane", "earthmover",
  ];

  const scores: Record<string, number> = {
    residential: 0,
    commercial: 0,
    industrial: 0,
    land: 0,
    vehicle: 0,
  };

  for (const kw of residentialKeywords) { if (lower.includes(kw)) scores.residential++; }
  for (const kw of commercialKeywords) { if (lower.includes(kw)) scores.commercial++; }
  for (const kw of industrialKeywords) { if (lower.includes(kw)) scores.industrial++; }
  for (const kw of landKeywords) { if (lower.includes(kw)) scores.land++; }
  for (const kw of vehicleKeywords) { if (lower.includes(kw)) scores.vehicle++; }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

// ─── Price Parser ───────────────────────────────────────────────────────────

function parseIndianAmount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[₹,Rs.INR\s]/gi, "").trim();

  let multiplier = 1;
  const lower = cleaned.toLowerCase();
  if (lower.includes("crore") || lower.includes("cr")) {
    multiplier = 10000000;
  } else if (lower.includes("lakh") || lower.includes("lac")) {
    multiplier = 100000;
  }

  const numericMatch = cleaned.match(/([\d.]+)/);
  if (!numericMatch) return null;

  const value = parseFloat(numericMatch[1]);
  if (isNaN(value) || value <= 0) return null;

  return value * multiplier;
}

// ─── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse structured property intelligence from BaankNet PDF text.
 */
export function parseBaanknetPropertyText(text: string): ParsedPropertyIntelligence {
  const result: ParsedPropertyIntelligence = {
    propertyClassification: null,
    carpetAreaSqft: null,
    builtUpAreaSqft: null,
    landAreaSqft: null,
    areaRawText: null,
    sarfaesiSection: null,
    possessionType: null,
    possessionDate: null,
    valuationAmount: null,
    distressValue: null,
    valuerName: null,
    valuationDate: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    contactBranch: null,
    emdAccountNumber: null,
    emdAccountIfsc: null,
    emdBankName: null,
    surveyNumber: null,
    encumbranceSummary: null,
  };

  if (!text || text.trim().length < 50) return result;

  // 1. Property classification
  result.propertyClassification = classifyPropertyType(text);

  // 2. Area extraction
  const carpetMatch = text.match(/(?:carpet|super\s*built[\s-]*up|built[\s-]*up)\s*area\s*:?\s*([^\n]{5,60})/i);
  if (carpetMatch) {
    const parsed = parseAreaToSqft(carpetMatch[1]);
    result.carpetAreaSqft = parsed.sqft;
    result.areaRawText = parsed.raw;
  }

  const landMatch = text.match(/(?:land|plot|total)\s*area\s*:?\s*([^\n]{5,60})/i);
  if (landMatch) {
    const parsed = parseAreaToSqft(landMatch[1]);
    result.landAreaSqft = parsed.sqft;
    if (!result.areaRawText) result.areaRawText = parsed.raw;
  }

  // If no labeled area found, try general area extraction
  if (!result.carpetAreaSqft && !result.landAreaSqft) {
    const generalArea = parseAreaToSqft(text);
    result.carpetAreaSqft = generalArea.sqft;
    result.areaRawText = generalArea.raw;
  }

  // 3. SARFAESI section
  const sarfaesiMatch = text.match(/(?:section|sec\.?)\s*(13\(\d\)|14|35)/i);
  if (sarfaesiMatch) {
    result.sarfaesiSection = `Section ${sarfaesiMatch[1]}`;
  }

  // 4. Possession
  const possessionMatch = text.match(/(?:symbolic|physical)\s*possession/i);
  if (possessionMatch) {
    result.possessionType = possessionMatch[0].trim();
  }

  const possDateMatch = text.match(/possession\s*(?:taken\s*)?(?:on|date)\s*:?\s*([\d\-/]+)/i);
  if (possDateMatch) {
    result.possessionDate = possDateMatch[1].trim();
  }

  // 5. Valuation
  const valuationMatch = text.match(/(?:fair\s*market|market)\s*value\s*:?\s*(?:₹|Rs\.?)\s*([\d,.\s]+(?:lakh|lac|crore|cr)?)/i);
  if (valuationMatch) {
    result.valuationAmount = parseIndianAmount(valuationMatch[1]);
  }

  const distressMatch = text.match(/(?:distress|forced\s*sale|realizable)\s*value\s*:?\s*(?:₹|Rs\.?)\s*([\d,.\s]+(?:lakh|lac|crore|cr)?)/i);
  if (distressMatch) {
    result.distressValue = parseIndianAmount(distressMatch[1]);
  }

  const valuerMatch = text.match(/(?:approved\s*valuer|registered\s*valuer|valuer\s*name)\s*:?\s*([A-Za-z\s.]{5,60})/i);
  if (valuerMatch) {
    result.valuerName = valuerMatch[1].trim();
  }

  const valDateMatch = text.match(/(?:valuation\s*date|date\s*of\s*valuation)\s*:?\s*([\d\-/]+)/i);
  if (valDateMatch) {
    result.valuationDate = valDateMatch[1].trim();
  }

  // 6. Contact extraction
  const officerMatch = text.match(/(?:authorized|authorised)\s*officer\s*:?\s*([A-Za-z\s.]{3,50})/i);
  if (officerMatch) {
    result.contactName = officerMatch[1].trim();
  }

  const phoneMatch = text.match(/(?:phone|mobile|contact|tel)\s*(?:no\.?|number)?\s*:?\s*(\+?91[\s-]?)?([6-9]\d{9})/i);
  if (phoneMatch) {
    result.contactPhone = phoneMatch[2];
  } else {
    // Fallback: find any 10-digit mobile number
    const mobileMatch = text.match(/\b([6-9]\d{9})\b/);
    if (mobileMatch) result.contactPhone = mobileMatch[1];
  }

  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch && !emailMatch[1].includes("baanknet") && !emailMatch[1].includes("support")) {
    result.contactEmail = emailMatch[1];
  }

  const branchMatch = text.match(/(?:branch)\s*:?\s*([A-Za-z\s,]{3,50})/i);
  if (branchMatch) {
    result.contactBranch = branchMatch[1].trim();
  }

  // 7. EMD bank details
  const accMatch = text.match(/(?:a\/c\s*(?:no\.?|number)?|account\s*(?:no\.?|number)?)\s*:?\s*(\d{9,18})/i);
  if (accMatch) result.emdAccountNumber = accMatch[1].trim();

  const ifscMatch = text.match(/(?:ifsc(?:\s*code)?|rtgs\/neft\s*ifsc|ifs\s*code)\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  if (ifscMatch) result.emdAccountIfsc = ifscMatch[1].trim().toUpperCase();

  const bankMatch = text.match(/(?:beneficiary\s*bank|bank\s*name|emd\s*remittance\s*bank)\s*:?\s*([A-Za-z\s&]+(?:bank|branch))/i);
  if (bankMatch) result.emdBankName = bankMatch[1].trim();

  // 8. Survey / Khasra number
  const surveyMatch = text.match(/(?:survey\s*no\.?|khasra\s*no\.?|plot\s*no\.?|khata\s*no\.?)\s*:?\s*([\w\-/,.\s]{2,30})/i);
  if (surveyMatch) result.surveyNumber = surveyMatch[1].trim();

  // 9. Encumbrance
  const encMatch = text.match(/(?:encumbrance|encumbered|mortgage|hypothecated)\s*:?\s*([^\n]{10,100})/i);
  if (encMatch) result.encumbranceSummary = encMatch[1].trim();

  return result;
}
