/**
 * BaankNet Document Classifier
 *
 * Classifies BaankNet auction PDF documents by analyzing extracted text content.
 * Mirrors the MSTC documentClassifier pattern for consistent cross-portal behavior.
 *
 * Classification types:
 *   - sale_notice       — Primary SARFAESI/DRT auction sale notice
 *   - valuation_report  — Certified property valuation by approved valuer
 *   - annexure          — Supporting schedules, maps, property photos
 *   - terms_conditions  — Terms and conditions of sale
 *   - possession_notice — Symbolic/physical possession notice (Sec 13(4))
 *   - demand_notice     — Demand notice under SARFAESI (Sec 13(2))
 *   - form_g            — IBC Form G (invitation for expression of interest)
 *   - unknown           — Could not classify
 */

export type BaanknetDocumentType =
  | "sale_notice"
  | "valuation_report"
  | "annexure"
  | "terms_conditions"
  | "possession_notice"
  | "demand_notice"
  | "form_g"
  | "unknown";

interface ClassificationResult {
  type: BaanknetDocumentType;
  confidence: number; // 0.0 - 1.0
  matchedKeywords: string[];
}

/** Keyword groups with weights for each document type. */
const CLASSIFICATION_RULES: {
  type: BaanknetDocumentType;
  keywords: string[];
  weight: number;
}[] = [
  {
    type: "sale_notice",
    keywords: [
      "sale notice",
      "e-auction sale",
      "auction notice",
      "notice for sale",
      "public auction",
      "sarfaesi",
      "section 13(4)",
      "sec. 13(4)",
      "rule 8",
      "rule 9",
      "reserve price",
      "emd amount",
      "earnest money",
      "auction date",
      "bid start",
      "bid end",
      "authorized officer",
      "authorised officer",
      "secured creditor",
    ],
    weight: 1.0,
  },
  {
    type: "valuation_report",
    keywords: [
      "valuation report",
      "valuation certificate",
      "property valuation",
      "approved valuer",
      "government approved valuer",
      "fair market value",
      "distress value",
      "realizable value",
      "forced sale value",
      "replacement cost",
      "depreciation",
      "land rate",
      "circle rate",
      "guideline value",
      "registered valuer",
    ],
    weight: 1.0,
  },
  {
    type: "possession_notice",
    keywords: [
      "possession notice",
      "symbolic possession",
      "physical possession",
      "section 13(4)",
      "sec. 13(4)",
      "taken possession",
      "notice of possession",
      "panchnama",
      "possession taken on",
    ],
    weight: 1.0,
  },
  {
    type: "demand_notice",
    keywords: [
      "demand notice",
      "section 13(2)",
      "sec. 13(2)",
      "notice under section 13",
      "recall notice",
      "60 days",
      "outstanding amount",
      "npa",
      "non-performing asset",
      "classification date",
    ],
    weight: 1.0,
  },
  {
    type: "form_g",
    keywords: [
      "form g",
      "form-g",
      "expression of interest",
      "eoi",
      "insolvency",
      "liquidation",
      "nclt",
      "ibbi",
      "resolution professional",
      "liquidator",
      "corporate debtor",
      "insolvency and bankruptcy",
    ],
    weight: 1.0,
  },
  {
    type: "terms_conditions",
    keywords: [
      "terms and conditions",
      "terms & conditions",
      "conditions of sale",
      "general conditions",
      "bidding rules",
      "refund of emd",
      "forfeiture",
      "payment schedule",
      "sale confirmation",
      "sale certificate",
      "indemnity",
    ],
    weight: 0.8,
  },
  {
    type: "annexure",
    keywords: [
      "annexure",
      "annexure-",
      "schedule of property",
      "schedule of properties",
      "property schedule",
      "list of properties",
      "property details",
      "map",
      "site plan",
      "survey number",
      "khasra",
      "khata",
      "mouza",
      "bounded by",
    ],
    weight: 0.7,
  },
];

/**
 * Classify a BaankNet document based on its extracted text content.
 *
 * Returns the most likely document type, confidence score, and matched keywords.
 */
export function classifyBaanknetDocument(text: string): ClassificationResult {
  if (!text || text.trim().length < 20) {
    return { type: "unknown", confidence: 0, matchedKeywords: [] };
  }

  const lowerText = text.toLowerCase();
  let bestType: BaanknetDocumentType = "unknown";
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const rule of CLASSIFICATION_RULES) {
    const matched: string[] = [];
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword)) {
        matched.push(keyword);
      }
    }

    if (matched.length === 0) continue;

    // Score = (matched / total keywords) * weight
    const score = (matched.length / rule.keywords.length) * rule.weight;

    if (score > bestScore) {
      bestScore = score;
      bestType = rule.type;
      bestMatches = matched;
    }
  }

  // Require at least 2 keyword matches for a confident classification
  if (bestMatches.length < 2) {
    return { type: "unknown", confidence: bestScore, matchedKeywords: bestMatches };
  }

  return {
    type: bestType,
    confidence: Math.min(bestScore, 1.0),
    matchedKeywords: bestMatches,
  };
}

/**
 * Classify multiple documents and return an array of classification results.
 * Useful for batch processing all documents of a single auction.
 */
export function classifyBaanknetDocuments(
  documents: { url: string; text: string }[]
): { url: string; classification: ClassificationResult }[] {
  return documents.map((doc) => ({
    url: doc.url,
    classification: classifyBaanknetDocument(doc.text),
  }));
}
