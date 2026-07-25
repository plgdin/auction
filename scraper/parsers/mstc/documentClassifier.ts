/**
 * Document text classifier.
 */

const TERMS_KEYWORDS: readonly string[] = [
  "special terms",
  "general terms",
  "terms and conditions",
  "terms & conditions",
  "payment terms",
  "payment schedule",
  "bank details for emd",
  "instruction to bidders",
  "instructions to bidders",
  "procedure for participation",
  "e-auction process",
  "important note for bidders",
  "disclaimer:",
  "mode of payment",
  "submission of emd",
  "earnest money deposit rules",
];

const INVENTORY_KEYWORDS: readonly string[] = [
  "lot no",
  "item no",
  "lot number",
  "description of lot",
  "qty",
  "quantity",
  "location:",
  "custodian",
  "scrap",
  "sub-item",
  "sub item",
];

export function isTermsOrInstructionPage(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  const lower = text.toLowerCase();

  let termsMatches = 0;
  for (const kw of TERMS_KEYWORDS) {
    if (lower.includes(kw)) {
      termsMatches++;
    }
  }

  let inventoryMatches = 0;
  for (const kw of INVENTORY_KEYWORDS) {
    if (lower.includes(kw)) {
      inventoryMatches++;
    }
  }

  if (termsMatches >= 2 && inventoryMatches === 0) {
    return true;
  }

  if (termsMatches >= 3 && inventoryMatches <= 1) {
    return true;
  }

  const lotMatches = (lower.match(/\blot\s+(?:no|number|\d+)\b/g) || []).length;
  if (termsMatches >= 2 && lotMatches === 0) {
    return true;
  }

  return false;
}

export function stripBoilerplateSections(text: string): string {
  if (!text) return "";

  let cleaned = text;

  cleaned = cleaned.replace(
    /(?:SPECIAL\s*TERMS\s*AND\s*CONDITIONS|GENERAL\s*TERMS\s*AND\s*CONDITIONS|INSTRUCTIONS?\s*TO\s*BIDDERS?)[\s\S]*$/i,
    ""
  );

  cleaned = cleaned.replace(
    /NOTE\s*:\s*[\s\S]{100,500}?(?=\n\s*(?:LOT\s*NO|ITEM\s*NO|\d+\.))/gi,
    ""
  );

  return cleaned.trim();
}
