/**
 * MSTC catalog PDF text parser.
 *
 * Orchestrates the extraction of structured auction metadata from raw
 * MSTC e-commerce catalog PDF text by delegating to focused extractors.
 */

// Re-export all types for backward compatibility
export type {
  SubItem,
  CatalogItem,
  KeyContact,
  DepositDetails,
  CatalogSummary,
} from "../types.js";

import type { SubItem, CatalogSummary } from "../types.js";
import { extractKeyContacts } from "./contactExtractor.js";
import { extractDepositDetails } from "./emdExtractor.js";
import { parseLotBlocks } from "./lotParser.js";
import { extractInspectionDetails } from "./inspectionExtractor.js";

export function parseMstcCatalogText(
  text: string,
  categoryName: string,
  sellerName: string,
  location: string,
): CatalogSummary {
  const lines = text.split("\n").map((l) => l.trim());
  const cleanText = lines.join("\n");

  const auctionTypeMatch = cleanText.match(
    /(?:auction\s+type|type\s+of\s+auction)\s*:?\s*([A-Za-z0-9]\s*-\s*[A-Za-z0-9_-]+(?:\s+Auction)?)/i,
  );
  let auctionType = auctionTypeMatch?.[1]?.trim();
  if (auctionType) {
    auctionType = auctionType.replace(/^([A-Za-z0-9])\s*-\s*/i, '$1-');
    if (/^C-\s*[Cc]ustoms?$/i.test(auctionType)) {
      auctionType = 'C-Customs';
    } else if (/^O-\s*[Gg]e[rn]e?r?a?l$/i.test(auctionType)) {
      auctionType = 'O-General';
    }
  } else {
    if (/customs/i.test(sellerName) || /customs/i.test(cleanText)) {
      auctionType = 'C-Customs';
    } else {
      auctionType = 'O-General';
    }
  }

  const keyContacts = extractKeyContacts(cleanText);
  const items = parseLotBlocks(cleanText, categoryName);
  const isCustoms = auctionType === 'C-Customs';
  const depositDetails = extractDepositDetails(cleanText, isCustoms);

  let totalPreBid = 0;
  let hasPreBidEmd = false;
  for (const it of items) {
    if (it.preBidEmd) {
      const cleanVal = it.preBidEmd.replace(/[^\d]/g, "");
      const val = parseInt(cleanVal, 10);
      if (!isNaN(val)) {
        totalPreBid += val;
        hasPreBidEmd = true;
      }
    }
  }

  if (hasPreBidEmd && items.length > 1) {
    depositDetails.preBidDdg = `₹${totalPreBid.toLocaleString("en-IN")}`;
  }

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

  const eligibility: string[] = [
    "Valid MSTC Buyer Registration in active status.",
    "GSTIN Registration Certificate matching the buyer profile.",
  ];

  let hasHazardous = false;
  let hasEWaste = false;
  let hasRVSF = false;

  for (const it of items) {
    const descLower = (it.description || "").toLowerCase();
    const pcbLower = (it.pcbGroup || "").toLowerCase();

    if (
      descLower.includes("hazardous") ||
      descLower.includes("battery") ||
      descLower.includes("used oil") ||
      descLower.includes("waste oil") ||
      pcbLower.includes("hazardous")
    ) {
      hasHazardous = true;
    }

    if (
      descLower.includes("e-waste") ||
      descLower.includes("ewaste") ||
      descLower.includes("telecom") ||
      descLower.includes("cable") ||
      pcbLower.includes("e-waste") ||
      pcbLower.includes("ewaste")
    ) {
      hasEWaste = true;
    }

    if (
      pcbLower.includes("rvsf") ||
      descLower.includes("rvsf")
    ) {
      hasRVSF = true;
    }
  }

  if (hasHazardous) {
    eligibility.push(
      "Hazardous waste/smelter authorization from State Pollution Control Board (SPCB) is mandatory.",
    );
  }
  if (hasEWaste) {
    eligibility.push(
      "CPCB/SPCB E-Waste recycler registration required for e-waste lots.",
    );
  }
  if (hasRVSF) {
    eligibility.push(
      "Registered Vehicle Scrapping Facility (RVSF) authorization is mandatory for End-of-Life Vehicles (ELV).",
    );
  }

  const inspectionDetails = extractInspectionDetails(text, keyContacts);

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

export function parseSubItemsFromText(text: string): SubItem[] {
  if (!text) return [];
  const subItems: SubItem[] = [];

  const UNITS =
    "nos|no|sets|set|kgs|kg|gms|gm|mts|mt|mtr|mtrs|ltrs|ltr|pcs|pc|" +
    "items|item|units|unit|bags|bag|box|boxes|bdl|bdls|coil|coils|" +
    "roll|rolls|ac|pair|pairs|drums|drum|sheets|sheet|ton|tons|" +
    "gross|dozen|doz|bottles|bottle|bunches|bunch|reams|ream|each|" +
    "bundle|bundles|set\\/nos|nos\\/set|" +
    "cum|cft|cbm|rm|rft";

  const unitsRegex = new RegExp(`^(?:${UNITS})\\b`, "i");

  let normalized = text.replace(/\|/g, " ").replace(/\t/g, " ");

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

  prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized.replace(
      /(\d+[\d,.]*)(\s+)(\d{1,3})\s+([A-Z][A-Z][A-Z])/g,
      "$1\n$3 $4",
    );
  }

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

  const splitFirstItem = new RegExp(
    `\\b(?:photograph|photo|uom|unit|qty|quantity|description|location|state|gst|tcs)\\s+(\\d{1,2})\\s+([A-Z])`,
    "i",
  );
  normalized = normalized.replace(splitFirstItem, "\n$1 $2");

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

  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim());
  const mergedLines: string[] = [];
  let currentLine = "";

  function startsWithSerial(line: string): boolean {
    if (/^\d+\.\d+/.test(line)) return false;
    const match = line.match(/^(\d+)([\s.-]+)?(.*)$/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    if (num === 0 || num > 150) return false;
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

    const isUnitAfterSr = new RegExp(
      `^\\d+\\s*\\b(${UNITS})\\b`,
      "i",
    ).test(matchLine);
    if (isUnitAfterSr) continue;

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
    let desc = rawDesc.trim();
    desc = desc.replace(/,?\s*Qty\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Quantity\s*:\s*$/i, "");
    desc = desc.replace(/,?\s*Qty\s*-\s*$/i, "");
    desc = desc.trim();

    if (desc.length < 2 || desc.length > 160) return;

    const meaningfulWords = desc
      .split(/[^a-zA-Z]+/)
      .filter((w) => w.length >= 3);
    if (meaningfulWords.length < 2) return;

    const instructionKeywords =
      /\b(?:payment|e-payment|bidder|bidders|bid\s+value|bid\s+price|reserve\s+price|earnest\s+money|security\s+deposit|emd|levies|duties|statutory|authorities|click\s+here|download|website|portal|annexure|appendix|refund|forfeit|forfeiture|successful\s+bidder|shall\s+be|will\s+be|should\s+be|available\s+at|mobile|phone|email|manager|officer|telephone|contact\s+person|terms\s+and\s+conditions|instructions\s+to|guide\s+for|payment\s+procedure)\b/i;
    if (instructionKeywords.test(desc)) return;

    const cleanQtyStr = qty.replace(/[^0-9.]/g, "");
    const numQty = parseFloat(cleanQtyStr);
    if (!isNaN(numQty) && numQty > 5000000) return;

    const sr = parseInt(srStr, 10);
    if (isNaN(sr) || sr <= 0) return;
    const normalizedDesc = desc.toLowerCase().replace(/\s+/g, " ").trim();

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
