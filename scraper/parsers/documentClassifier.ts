/**
 * Document text classifier.
 *
 * Classifies raw text blocks as inventory data, terms & conditions,
 * payment instructions, or contact information BEFORE they enter the
 * parsing pipeline. This prevents payment guidelines and legal text
 * from being incorrectly parsed as sub-items.
 *
 * Also centralizes the "is this a terms page?" check that was previously
 * duplicated 3× across assetWorker.ts.
 */

// ─── Terms / Instruction Keywords ────────────────────────────────────────────

/**
 * Phrases that indicate a text block is terms & conditions, payment
 * instructions, or other boilerplate rather than inventory data.
 */
const TERMS_KEYWORDS: readonly string[] = [
  "special terms",
  "general terms",
  "instructions to bidders",
  "instructions to the bidder",
  "payment guidelines",
  "how to participate",
  "terms and conditions",
  "terms & conditions",
  "guide for making payment",
  "payment procedure",
  "e-payment",
  "pre-bid emd",
  "important instructions",
  "seller specific terms",
  "bidder registration",
  "dispute resolution",
  "force majeure",
  "arbitration clause",
  "indemnity clause",
  "jurisdiction of courts",
  "limitation of liability",
] as const;

/**
 * Phrases that strongly indicate a contact / officer information block.
 */
const CONTACT_BLOCK_KEYWORDS: readonly string[] = [
  "officer onename",
  "officer twoname",
  "contact person",
  "helpdesk",
  "customer care",
  "grievance officer",
  "toll free",
  "email id",
] as const;

/**
 * Phrases that indicate actual inventory / material listing content.
 */
const INVENTORY_KEYWORDS: readonly string[] = [
  "lot no",
  "lot name",
  "lot parameters",
  "product type",
  "start price",
  "bid increment",
  "quantity",
  "sl no",
  "serial no",
  "nomenclature",
  "description of material",
  "approximate qty",
] as const;

// ─── Public API ──────────────────────────────────────────────────────────────

export type TextBlockType = "inventory" | "terms" | "instructions" | "contact_info";

/**
 * Determine if a text block is a terms-and-conditions or instructional page.
 * This replaces the 3× duplicated inline check in assetWorker.ts.
 *
 * @param text - The raw text (selectable PDF text + OCR output).
 * @returns `true` if the text is boilerplate that should NOT be parsed for sub-items.
 */
export function isTermsOrInstructionPage(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Count how many terms keywords match
  let termsHits = 0;
  for (const kw of TERMS_KEYWORDS) {
    if (lower.includes(kw)) {
      termsHits++;
    }
  }

  // Count inventory keywords
  let inventoryHits = 0;
  for (const kw of INVENTORY_KEYWORDS) {
    if (lower.includes(kw)) {
      inventoryHits++;
    }
  }

  // If we have terms hits, check if terms density exceeds inventory density
  if (termsHits >= 2) {
    return termsHits > inventoryHits;
  }

  if (termsHits === 1) {
    // A single terms keyword only skips the page if no inventory markers exist
    return inventoryHits === 0;
  }

  // Check for high density of legal/instruction phrases
  const legalPhrases = [
    "shall be", "will be", "should be", "must be",
    "liable to", "subject to", "in accordance with",
    "hereby", "herein", "thereof", "notwithstanding",
  ];
  let legalHits = 0;
  for (const phrase of legalPhrases) {
    if (lower.includes(phrase)) legalHits++;
  }
  // If text has many legal phrases but no inventory markers, it's boilerplate
  if (legalHits >= 3) {
    return inventoryHits === 0;
  }

  return false;
}

/**
 * Classify a text block into one of four categories.
 *
 * @param text - The raw text block to classify.
 * @returns The classification: `inventory`, `terms`, `instructions`, or `contact_info`.
 */
export function classifyTextBlock(text: string): TextBlockType {
  if (!text || text.trim().length < 10) return "terms";

  const lower = text.toLowerCase();

  // Check contact blocks first (they are short and distinctive)
  const contactHits = CONTACT_BLOCK_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (contactHits >= 1) return "contact_info";

  // Check for terms/instructions
  if (isTermsOrInstructionPage(text)) return "terms";

  // Check for inventory markers
  const inventoryHits = INVENTORY_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (inventoryHits >= 1) return "inventory";

  // Default: treat short/ambiguous text as potential inventory (safe default for OCR pages)
  return "inventory";
}

/**
 * Strip known boilerplate sections from raw catalog text BEFORE lot splitting.
 *
 * This prevents terms-and-conditions text that happens to contain "Lot No -"
 * references from creating phantom lot blocks during the split.
 *
 * @param text - The full catalog text.
 * @returns The text with boilerplate sections removed.
 */
export function stripBoilerplateSections(text: string): string {
  // Define section header patterns that mark the start of boilerplate
  const boilerplateHeaders = [
    /(?:^|\n)\s*(?:seller\s+specific\s+terms\s+(?:and|&)\s+conditions)/i,
    /(?:^|\n)\s*(?:special\s+terms\s+(?:and|&)\s+conditions)/i,
    /(?:^|\n)\s*(?:general\s+terms\s+(?:and|&)\s+conditions)/i,
    /(?:^|\n)\s*(?:instructions\s+to\s+(?:the\s+)?bidder(?:s)?)/i,
    /(?:^|\n)\s*(?:payment\s+procedure)/i,
    /(?:^|\n)\s*(?:important\s+instructions)/i,
    /(?:^|\n)\s*(?:guide\s+for\s+making\s+payment)/i,
  ];

  let cleaned = text;
  for (const pattern of boilerplateHeaders) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      // Check if there are any lot blocks AFTER this point
      const afterBoilerplate = cleaned.substring(match.index);
      // (a real lot block must have Lot No followed shortly by Lot Name)
      const hasLotsAfter = /Lot No\s*-\s*\d+[\s\S]{1,500}?Lot Name\s*-\s*/i.test(afterBoilerplate);
      if (!hasLotsAfter) {
        cleaned = cleaned.substring(0, match.index);
      }
    }
  }

  return cleaned;
}
