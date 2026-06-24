/**
 * MSTC catalog PDF text parser.
 *
 * Orchestrates the extraction of structured auction metadata from raw
 * MSTC e-commerce catalog PDF text by delegating to focused extractors.
 *
 * This file is now a thin coordinator — all domain logic lives in:
 *   - contactExtractor.ts   (key contacts & officers)
 *   - emdExtractor.ts       (EMD / deposit details)
 *   - lotParser.ts          (lot blocks, quantities, attachments)
 *   - inspectionExtractor.ts (inspection schedule)
 *   - documentClassifier.ts  (text classification & boilerplate stripping)
 */

// Re-export all types for backward compatibility
export type {
  SubItem,
  CatalogItem,
  KeyContact,
  DepositDetails,
  CatalogSummary,
} from "./types.js";

import type { SubItem, CatalogSummary } from "./types.js";
import { extractKeyContacts } from "./contactExtractor.js";
import { extractDepositDetails } from "./emdExtractor.js";
import { parseLotBlocks } from "./lotParser.js";
import { extractInspectionDetails } from "./inspectionExtractor.js";

// ─── Parser Orchestrator ─────────────────────────────────────────────────────

/**
 * Parse MSTC catalog PDF text into a structured summary object.
 *
 * This is the single public entry point consumed by assetWorker.ts.
 * The function signature and return type are identical to the pre-refactor
 * version — all downstream consumers are unaffected.
 */
export function parseMstcCatalogText(
  text: string,
  categoryName: string,
  sellerName: string,
  location: string,
): CatalogSummary {
  const lines = text.split("\n").map((l) => l.trim());
  const cleanText = lines.join("\n");

  // The auction type is catalogue metadata, not the material category.
  const auctionTypeMatch = cleanText.match(
    /(?:auction\s+type|type\s+of\s+auction)\s*:?\s*(O-[A-Za-z0-9_-]+(?:\s+Auction)?)/i,
  );
  const auctionType = auctionTypeMatch?.[1]?.trim();

  // 1. Extract contacts
  const keyContacts = extractKeyContacts(lines, text);

  // 2. Extract deposit details
  const depositDetails = extractDepositDetails(cleanText);

  // 3. Parse lot blocks
  const items = parseLotBlocks(cleanText, categoryName);

  // 4. Build overview & scope
  const uniqueItemNames = Array.from(
    new Set(items.map((it) => it.description.trim())),
  ).filter(Boolean);

  let itemNamesSummary = "";
  if (uniqueItemNames.length === 0) {
    itemNamesSummary = "designated materials";
  } else if (uniqueItemNames.length <= 3) {
    itemNamesSummary = uniqueItemNames.join(", ").toLowerCase();
  } else {
    itemNamesSummary = `${uniqueItemNames.slice(0, 3).join(", ").toLowerCase()} and other materials`;
  }

  const overview = `This auction is conducted by MSTC on behalf of ${sellerName} for the disposal of ${itemNamesSummary} located at ${location || "designated site areas"}.`;
  const scopeOfWork = `Lifting, clearing, and disposal of designated lots of ${itemNamesSummary} in accordance with MSTC Special Terms & Conditions (STC). All items are sold on an "As-Is-Where-Is" basis.`;

  // 5. Eligibility
  const eligibility: string[] = [
    "Valid MSTC Buyer Registration in active status.",
    "GSTIN Registration Certificate matching the buyer profile.",
  ];

  const textLower = text.toLowerCase();
  if (
    textLower.includes("hazardous") ||
    textLower.includes("waste") ||
    textLower.includes("battery") ||
    textLower.includes("oil")
  ) {
    eligibility.push(
      "Hazardous waste/smelter authorization from State Pollution Control Board (SPCB) is mandatory.",
    );
  }
  if (
    textLower.includes("telecom") ||
    textLower.includes("cable") ||
    textLower.includes("e-waste")
  ) {
    eligibility.push(
      "CPCB/SPCB E-Waste recycler registration required for e-waste lots.",
    );
  }

  // 6. Inspection details
  const inspectionDetails = extractInspectionDetails(text, keyContacts);

  // 7. Extract scheduled start and close date/time
  const startMatch = cleanText.match(/(?:Scheduled\s+Auction\s+Start\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Start\s+Date\s*(?:and|&)\s*Time|Auction\s+Start\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Auction\s+Start\s+Date|Auction\s+Start\s+Date)\s*[:|.-]?\s*(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i);
  const auctionStartTime = startMatch ? startMatch[1].trim() : undefined;

  const closeMatch = cleanText.match(/(?:Scheduled\s+Auction\s+Close\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Close\s+Date\s*(?:and|&)\s*Time|Auction\s+Close\s+Date\s*(?:and|&)\s*Time|Scheduled\s+Auction\s+Close\s+Date|Auction\s+Close\s+Date)\s*[:|.-]?\s*(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i);
  const auctionCloseTime = closeMatch ? closeMatch[1].trim() : undefined;

  return {
    overview,
    scopeOfWork,
    items,
    eligibility,
    depositDetails,
    keyContacts,
    inspectionDetails,
    auctionType,
    auctionStartTime,
    auctionCloseTime,
  };
}

// ─── Sub-Item Parser (Hardened) ──────────────────────────────────────────────

/**
 * Parse sub-items from a block of text (selectable or OCR).
 *
 * Handles three common formats from OCR-processed PDF tables:
 *   1. "<sr>. DESCRIPTION <unit> <qty>"   e.g., "1 PLASTIC CHAIR Nos 5"
 *   2. "<sr>. DESCRIPTION <qty> <unit>"   e.g., "1 PLASTIC CHAIR 5 Nos"
 *   3. "<sr>. DESCRIPTION <qty>"          e.g., "1 PLASTIC CHAIR 5" (defaults unit to Nos)
 *
 * Fixes applied:
 * - Strengthened dedup key uses full normalized description (not just 30 chars).
 * - OCR noise filter requires ≥2 alphabetic words of length ≥3 in description.
 * - Payment/instruction clauses are filtered more aggressively.
 */
export function parseSubItemsFromText(text: string): SubItem[] {
  if (!text) return [];
  const subItems: SubItem[] = [];

  // Comprehensive unit keywords for Indian government surplus auctions
  const UNITS =
    "nos|no|sets|set|kgs|kg|gms|gm|mts|mt|mtr|mtrs|ltrs|ltr|pcs|pc|" +
    "items|item|units|unit|bags|bag|box|boxes|bdl|bdls|coil|coils|" +
    "roll|rolls|ac|pair|pairs|drums|drum|sheets|sheet|ton|tons|" +
    "gross|dozen|doz|bottles|bottle|bunches|bunch|reams|ream|each|" +
    "bundle|bundles|set\\/nos|nos\\/set|" +
    "cum|cft|cbm|rm|rft";

  const unitsRegex = new RegExp(`^(?:${UNITS})\\b`, "i");

  // Step 1: Normalize text
  let normalized = text.replace(/\|/g, " ").replace(/\t/g, " ");

  // Step 2: Pre-split concatenated items
  const splitOnUnitQty = new RegExp(
    `(\\b(?:${UNITS})\\.?\\s+\\d+[\\d,.]*)\\s+(\\d{1,3})\\.?\\s+([A-Z])`,
    "gi",
  );
  let prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnUnitQty, "$1\n$2 $3");
  }

  const splitOnQtyUnitNewSerial = new RegExp(
    `(\\b\\d+[\\d,.]*\\s+(?:${UNITS})\\b\\.?)\\s+(\\d{1,3})\\s+([A-Z])`,
    "gi",
  );
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(splitOnQtyUnitNewSerial, "$1\n$2 $3");
  }

  // Bare quantity followed by serial + uppercase word (3+ chars)
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(
      /(\d+[\d,.]*)(\s+)(\d{1,3})\s+([A-Z][A-Z][A-Z])/g,
      "$1\n$3 $4",
    );
  }

  // Hyphenated serials
  const splitOnQtyUnitNewSerialHyphen = new RegExp(
    `(\\b(?:${UNITS})\\b\\.?\\s*\\d+[\\d,.]*|\\b\\d+[\\d,.]*\\s*(?:${UNITS})\\b\\.?)\\s+(\\d{1,3})\\-([A-Z])`,
    "gi",
  );
  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(
      splitOnQtyUnitNewSerialHyphen,
      "$1\n$2-$3",
    );
  }

  // Split first item from header row if run together
  const splitFirstItem = new RegExp(
    `\\b(?:photograph|photo|uom|unit|qty|quantity|description|location|state|gst|tcs)\\s+(\\d{1,2})\\s+([A-Z])`,
    "i",
  );
  normalized = normalized.replace(splitFirstItem, "\n$1 $2");

  // Fallback split with intermediate text
  const splitOnIntermediateText =
    /([a-zA-Z]+)\s+(\d+[\d,.]*)\s+([^0-9\n]{2,100}?)\s+(\d{1,3})\s+([A-Z][A-Z][A-Z])/g;
  let prevVal = "";
  while (prevVal !== normalized) {
    prevVal = normalized;
    normalized = normalized.replace(
      splitOnIntermediateText,
      "$1 $2 $3\n$4 $5",
    );
  }

  // Step 3: Line-merging pre-pass
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim());
  const mergedLines: string[] = [];
  let currentLine = "";

  function startsWithSerial(line: string): boolean {
    if (/^\d+\.\d+/.test(line)) return false;
    const match = line.match(/^(\d+)([\s.-]+)?(.*)$/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    if (num > 150) return false;
    const rest = match[3].trim();
    if (unitsRegex.test(rest)) return false;
    return true;
  }

  for (const line of rawLines) {
    if (!line) continue;
    if (startsWithSerial(line)) {
      if (currentLine) {
        mergedLines.push(currentLine);
      }
      currentLine = line;
    } else {
      if (currentLine) {
        currentLine += " " + line;
      } else {
        mergedLines.push(line);
      }
    }
  }
  if (currentLine) {
    mergedLines.push(currentLine);
  }

  // Step 4: Process line by line
  for (const line of mergedLines) {
    const lower = line.toLowerCase();

    let cleanedLine = line
      .replace(/\b\d+\.?\d*\s*%/g, "")
      .replace(/Mob\.?\s*No\.?\s*[\d\s-]+/gi, "")
      .replace(
        /Contact\s*(?:Number|No\.?)\s*:?\s*[\d\s-]+/gi,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();

    // Truncate after the last <number> <unit> match
    const lastUnitMatch = new RegExp(
      `(\\d+[\\d,.]*)\\s+(${UNITS})\\b\\.?`,
      "gi",
    );
    let lastMatchEnd = -1;
    let um;
    while ((um = lastUnitMatch.exec(cleanedLine)) !== null) {
      lastMatchEnd = um.index + um[0].length;
    }
    if (lastMatchEnd > 0 && lastMatchEnd < cleanedLine.length) {
      cleanedLine = cleanedLine.substring(0, lastMatchEnd).trim();
    }

    // Skip header rows, page markers, and irrelevant labels
    if (
      /^sl[\s.]?no/i.test(line) ||
      /^serial\s*no/i.test(line) ||
      lower.includes("nomenclature") ||
      lower.includes("appendix") ||
      lower.includes("annexure") ||
      /\blot\s*no\b/i.test(line) ||
      lower.includes("lot parameters") ||
      lower.includes("lot name") ||
      (lower.includes("description") &&
        (lower.includes("qty") ||
          lower.includes("quantity") ||
          lower.includes("a/u"))) ||
      (lower.includes("quantity") &&
        (lower.includes("sl") ||
          lower.includes("unit") ||
          lower.includes("a/u"))) ||
      lower.includes("u.o.m") ||
      lower.includes("gst%") ||
      /\bpage\s+\d/i.test(line) ||
      /^total\b/i.test(line) ||
      /^grand\s*total/i.test(line) ||
      /^sub\s*total/i.test(line)
    ) {
      continue;
    }
    const matchLine = cleanedLine || line;

    // Skip lines where serial is immediately followed by a unit keyword
    const isUnitAfterSr = new RegExp(
      `^\\d+\\s*\\b(${UNITS})\\b`,
      "i",
    ).test(matchLine);
    if (isUnitAfterSr) continue;

    // Match 1: "<sr>. DESCRIPTION <unit> <qty>"
    const m1 = matchLine.match(
      new RegExp(
        `^(\\d{1,3})[\\s.-]+(.+?)\\s+\\b(${UNITS})\\b\\.?\\s+(\\d+[\\d,.]*)\\s*$`,
        "i",
      ),
    );
    if (m1) {
      addItem(m1[1], m1[2], m1[3], m1[4]);
      continue;
    }

    // Match 2: "<sr>. DESCRIPTION <qty> <unit>"
    const m2 = matchLine.match(
      new RegExp(
        `^(\\d{1,3})[\\s.-]+(.+?)\\s+(\\d+[\\d,.]*)\\s+\\b(${UNITS})\\b\\.?\\s*$`,
        "i",
      ),
    );
    if (m2) {
      addItem(m2[1], m2[2], m2[4], m2[3]);
      continue;
    }

    // Match 3: "<sr>. DESCRIPTION <qty>" (no explicit unit)
    const m3 = matchLine.match(
      /^(\d{1,3})[\s.-]+(.+?)\s+(\d+[\d,.]*)(?:\s+[^0-9]+.*)?$/,
    );
    if (m3) {
      addItem(m3[1], m3[2], "Nos", m3[3]);
    }
  }

  function addItem(
    srStr: string,
    rawDesc: string,
    unit: string,
    qty: string,
  ) {
    // Clean trailing junk from description
    let desc = rawDesc.trim();
    desc = desc.replace(/,?\s*Qty\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Quantity\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Qty\s*-\s*$/i, "");
    desc = desc.trim();

    if (desc.length < 2 || desc.length > 160) return;

    // OCR noise filter: require ≥2 alphabetic words of length ≥3
    const meaningfulWords = desc
      .split(/[^a-zA-Z]+/)
      .filter((w) => w.length >= 3);
    if (meaningfulWords.length < 2) return;

    // Filter out boilerplate instructions/legal/contact clauses
    const instructionKeywords =
      /\b(?:payment|e-payment|bidder|bidders|bid\s+value|bid\s+price|reserve\s+price|earnest\s+money|security\s+deposit|emd|levies|duties|statutory|authorities|click\s+here|download|website|portal|annexure|appendix|refund|forfeit|forfeiture|successful\s+bidder|shall\s+be|will\s+be|should\s+be|available\s+at|mobile|phone|email|manager|officer|telephone|contact\s+person|terms\s+and\s+conditions|instructions\s+to|guide\s+for|payment\s+procedure)\b/i;
    if (instructionKeywords.test(desc)) return;

    // Filter out huge quantities (phone numbers / pin codes)
    const cleanQtyStr = qty.replace(/[^0-9.]/g, "");
    const numQty = parseFloat(cleanQtyStr);
    if (!isNaN(numQty) && numQty > 5000000) return;

    const sr = parseInt(srStr, 10);
    const normalizedDesc = desc.toLowerCase().replace(/\s+/g, " ").trim();

    // Two-row space optimized Levenshtein distance similarity calculation
    const getLevenshteinSimilarity = (s1: string, s2: string): number => {
      const m = s1.length;
      const n = s2.length;
      if (m === 0 || n === 0) return 0;

      let str1 = s1;
      let str2 = s2;
      let len1 = m;
      let len2 = n;
      if (len2 > len1) {
        str1 = s2;
        str2 = s1;
        len1 = n;
        len2 = m;
      }

      let prev = new Array(len2 + 1);
      let curr = new Array(len2 + 1);

      for (let j = 0; j <= len2; j++) {
        prev[j] = j;
      }

      for (let i = 1; i <= len1; i++) {
        curr[0] = i;
        for (let j = 1; j <= len2; j++) {
          if (str1[i - 1] === str2[j - 1]) {
            curr[j] = prev[j - 1];
          } else {
            curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
          }
        }
        const temp = prev;
        prev = curr;
        curr = temp;
      }

      return 1 - prev[len2] / Math.max(m, n);
    };

    const isDuplicate = subItems.some((existing) => {
      if (existing.sr !== sr) return false;
      const existingDesc = existing.description.toLowerCase().replace(/\s+/g, " ").trim();
      if (existingDesc === normalizedDesc) return true;
      // If Levenshtein similarity is >= 85%, treat as duplicate to catch OCR typos
      return getLevenshteinSimilarity(existingDesc, normalizedDesc) >= 0.85;
    });

    if (isDuplicate) return;

    subItems.push({
      sr,
      description: desc,
      unit: unit.trim(),
      qty: qty.trim(),
    });
  }

  return subItems;
}
