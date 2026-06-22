/**
 * Lot block parser for MSTC catalog PDFs.
 *
 * Handles splitting catalog text into lot blocks, extracting lot ID,
 * name, description, quantity, unit, GST, TCS, start price, and
 * attachment references from each block.
 *
 * Fixes applied:
 * - Strips boilerplate BEFORE splitting to prevent phantom lots.
 * - Negative guards on quantity regex to exclude GST/EMD/date/pin numbers.
 * - Expanded attachment detection beyond photo_/annex_ prefixes.
 * - Description-level quantity extraction for forestry catalogs.
 */
import type { CatalogItem } from "./types.js";
import { stripBoilerplateSections } from "./documentClassifier.js";
import { parseSubItemsFromText } from "./mstcParser.js";

// ─── Description Block Quantity Extraction ──────────────────────────────────

/**
 * Units commonly found inline in lot description text.
 */
const DESC_UNITS =
  "cum|cft|cbm|" +
  "kg|kgs|gms|gm|mt|mts|ton|tons|" +
  "nos|no|pcs|pc|sets|set|items|item|units|unit|" +
  "mtr|mtrs|rm|rft|" +
  "ltrs|ltr|bags|bag";

/**
 * Extract quantities embedded in a lot's description text block
 * (common in forestry/timber catalogs where quantities appear inline).
 */
function extractQuantitiesFromDescriptionBlock(
  block: string,
): { qty: string; unit: string } | null {
  const descMatch = block.match(
    /Category\s*-[^\n]*\n([\s\S]*?)(?=Quantity\s*-|Start\s*Price|Post\s*Bid|Bid\s*Increment|TCS\s*\()/i,
  );

  if (!descMatch) return null;

  const descText = descMatch[1];
  const descUnitRegex = new RegExp(
    `\\b(\\d+[\\d,.]*)\\s+(${DESC_UNITS})\\b`,
    "gi",
  );

  const groups: { [unit: string]: number } = {};
  let match;
  while ((match = descUnitRegex.exec(descText)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) {
      const u = match[2].toUpperCase().trim();
      groups[u] = (groups[u] || 0) + val;
    }
  }

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  if (entries.length === 1) {
    const [u, totalVal] = entries[0];
    const qty = Number.isInteger(totalVal)
      ? totalVal.toLocaleString("en-IN")
      : totalVal.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        });
    return { qty, unit: u };
  }

  // Multiple units: combine them
  const qty = entries
    .map(([u, totalVal]) => {
      const formatted = Number.isInteger(totalVal)
        ? totalVal.toLocaleString("en-IN")
        : totalVal.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          });
      return `${formatted} ${u}`;
    })
    .join(" + ");
  return { qty, unit: "" };
}

// ─── Quantity Extraction Guards ─────────────────────────────────────────────

/**
 * Keywords that, when appearing immediately before a number, indicate
 * the number is NOT a quantity (it's a GST rate, EMD, date, etc.).
 */
const QTY_NEGATIVE_PREFIX = /(?:GST|TCS|EMD|Date|Pin|A\/C|Account|Ref|Reference|Invoice|Bill|Receipt|Phone|Mobile|Telephone|Fax)\s*[:.-]?\s*$/i;

/**
 * Check if a quantity match is a false positive by examining its context.
 */
function isLikelyFalseQuantity(block: string, matchIndex: number): boolean {
  // Look at the 30 chars before the match
  const prefix = block.substring(Math.max(0, matchIndex - 30), matchIndex);
  return QTY_NEGATIVE_PREFIX.test(prefix);
}

// ─── Attachment Detection ───────────────────────────────────────────────────

/**
 * Extended attachment filename patterns.
 * Matches photo_, annex_, image_, img_, spec_, inventory_, doc_ prefixes
 * plus any .pdf reference found near lot block content.
 */
const ATTACHMENT_PATTERN = /([a-zA-Z0-9_]+\.pdf)/g;

/**
 * Check if a PDF filename looks like a lot-specific attachment.
 */
function isLotAttachment(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.startsWith("photo_") ||
    n.startsWith("annex_") ||
    n.startsWith("image_") ||
    n.startsWith("img_") ||
    n.startsWith("spec_") ||
    n.startsWith("inventory_") ||
    n.startsWith("doc_") ||
    n.startsWith("lot_")
  );
}

// ─── Format Helpers ─────────────────────────────────────────────────────────

function formatQuantity(totalVal: number): string {
  return Number.isInteger(totalVal)
    ? totalVal.toLocaleString("en-IN")
    : totalVal.toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse lot blocks from catalog text and return structured CatalogItem[].
 *
 * @param cleanText    - The normalized catalog text (lines joined by \n).
 * @param categoryName - The category name from the scraper for fallback descriptions.
 * @returns Array of parsed lot items.
 */
export function parseLotBlocks(
  cleanText: string,
  categoryName: string,
): CatalogItem[] {
  const items: CatalogItem[] = [];

  // Strip boilerplate BEFORE splitting to prevent phantom lots
  const safeText = stripBoilerplateSections(cleanText);
  const lotBlocks = safeText.split(/Lot\s*(?:No|Number|#)\s*[-:]?\s*/gi);

  if (lotBlocks.length <= 1) {
    // Fallback: no lots found
    items.push({
      sr: 1,
      description: categoryName || "Auction Lot Items",
      qty: "1",
      unit: "Lot",
      taxRate: "18% GST",
    });
    return items;
  }

  for (let i = 1; i < lotBlocks.length; i++) {
    const rawBlock = lotBlocks[i];

    // Validate if this block is a real lot block by checking for standard headers
    if (!/Lot Name\s*-/i.test(rawBlock) && !/Lot Location\s*-/i.test(rawBlock)) {
      continue; // Skip phantom lot
    }

    // Truncate lot block at boilerplate sections
    const boilerplatePattern =
      /(?:seller\s+specific\s+terms|special\s+terms\s+and\s+conditions|special\s+terms\s+&\s+conditions|general\s+terms\s+and\s+conditions|terms\s+&\s+conditions|terms\s+and\s+conditions|instructions\s+to\s+bidders|instructions\s+to\s+the\s+bidder|payment\s+procedure|e-payment|important\s+instructions)/i;
    const boilerplateIdx = rawBlock.search(boilerplatePattern);
    const block =
      boilerplateIdx !== -1
        ? rawBlock.substring(0, boilerplateIdx)
        : rawBlock;

    // ── Extract lot identifier ────────────────────────────────────────────
    const lotNameIdx = block.search(/Lot Name\s*-/i);
    let lotId: string;
    if (lotNameIdx > 0) {
      lotId = block
        .slice(0, lotNameIdx)
        .replace(/\r?\n/g, "")
        .trim();
    } else {
      const firstLines = block.split("\n").map((l) => l.trim());
      lotId = firstLines.find((l) => l.length > 0) || "";
    }

    if (!lotId || lotId.length > 80) continue;

    const numericLot = parseInt(lotId, 10);
    const sr: number | string =
      !isNaN(numericLot) && String(numericLot) === lotId
        ? numericLot
        : lotId;

    // ── Extract lot name ──────────────────────────────────────────────────
    let lotName = "";
    const nameMatch = block.match(
      /Lot Name\s*-\s*([\s\S]*?)(?=Product Type|Lot Location|State|Lot State|GST|TCS|Bid Valid|$)/i,
    );
    if (nameMatch) {
      lotName = nameMatch[1].replace(/\r?\n/g, " ").trim();
    }

    // ── Extract lot description ───────────────────────────────────────────
    let lotDescription = "";
    const descTextMatch = block.match(
      /Category\s*-[^\n]*\n([\s\S]*?)(?=Quantity\s*-|Start\s*Price|Post\s*Bid|Bid\s*Increment|TCS|GST|Lot Location|State)/i,
    );
    if (descTextMatch) {
      lotDescription = descTextMatch[1].replace(/\r?\n/g, " ").trim();
    }

    // ── Extract quantity & unit (with false-positive guards) ──────────────
    let qty = "1";
    let unit = "Lot";

    const qtyRegex = /(?:QTY|Quantity|Approx\s*Qty|Approximate\s*Qty|Net\s*Qty|Qty\s*\(\s*Approx\s*\))\s*[:.-]?\s*(?:\r?\n)?\s*([\d.,]+)(?:\s+([A-Za-z]+(?:[ \t]+[A-Za-z]+)*))?/gi;
    const matches = Array.from(block.matchAll(qtyRegex));

    // Filter out false positives
    const validMatches = matches.filter(
      (m) => m.index !== undefined && !isLikelyFalseQuantity(block, m.index),
    );

    if (validMatches.length > 0) {
      const groups: { [unit: string]: number } = {};
      for (const match of validMatches) {
        const valStr = match[1].replace(/,/g, "").trim();
        const val = parseFloat(valStr);
        if (!isNaN(val) && val < 5000000) {
          let u = (match[2] || "Unit").trim();
          
          // Reconstruct units split across newlines like "Per\nMonth"
          if (u.toLowerCase() === "per" && match.index !== undefined) {
            const remaining = block.substring(match.index + match[0].length).trim();
            const nextWordMatch = remaining.match(/^([A-Za-z]+)\b/);
            if (nextWordMatch) {
              const nextWord = nextWordMatch[1];
              const timeUnits = ["month", "annum", "day", "hour", "week", "year", "quarter"];
              if (timeUnits.includes(nextWord.toLowerCase())) {
                u = `Per ${nextWord}`;
              }
            }
          }
          
          const uKey = u.toUpperCase();
          groups[uKey] = (groups[uKey] || 0) + val;
        }
      }

      const groupEntries = Object.entries(groups);
      if (groupEntries.length === 1) {
        const [u, totalVal] = groupEntries[0];
        qty = formatQuantity(totalVal);
        unit = u === "UNIT" ? "Lot" : u;
      } else if (groupEntries.length > 1) {
        qty = groupEntries
          .map(([u, totalVal]) => `${formatQuantity(totalVal)} ${u}`)
          .join(" + ");
        unit = "";
      }
    } else {
      const qtyMatch = block.match(
        /(?:Quantity|Approx\s*Qty|Approximate\s*Qty|Net\s*Qty|Qty\s*\(\s*Approx\s*\))\s*-\s*([\d.,]+)(?:\s+([A-Za-z]+(?:[ \t]+[A-Za-z]+)*))?/i,
      );
      if (qtyMatch) {
        const parsedVal = parseFloat(qtyMatch[1].replace(/,/g, ""));
        if (!isNaN(parsedVal) && parsedVal < 5000000) {
          qty = qtyMatch[1].trim();
          let u = (qtyMatch[2] || "Lot").trim();
          
          // Reconstruct units split across newlines like "Per\nMonth"
          if (u.toLowerCase() === "per" && qtyMatch.index !== undefined) {
            const remaining = block.substring(qtyMatch.index + qtyMatch[0].length).trim();
            const nextWordMatch = remaining.match(/^([A-Za-z]+)\b/);
            if (nextWordMatch) {
              const nextWord = nextWordMatch[1];
              const timeUnits = ["month", "annum", "day", "hour", "week", "year", "quarter"];
              if (timeUnits.includes(nextWord.toLowerCase())) {
                u = `Per ${nextWord}`;
              }
            }
          }
          unit = u;
        }
      }
    }

    // ── Fallback: description-level quantities (forestry catalogs) ────────
    if ((qty === "1" || qty === "1.0") && unit.toLowerCase() === "lot") {
      const descQty = extractQuantitiesFromDescriptionBlock(block);
      if (descQty) {
        qty = descQty.qty;
        unit = descQty.unit;
      }
    }

    // ── Extract GST ─────────────────────────────────────────────────────
    let gst = "As Applicable";
    const gstMatch = block.match(
      /GST\s*(?:\(%\))?\s*-\s*([^\n]*?)(?=\r|\n|Lot Location|State|Lot State|TCS|Bid Valid|Start\s*Price|QTY|Quantity|Post\s*Bid|Bid\s*Increment|Category|Lot\s*Description|Lot\s*Name|$)/i,
    );
    if (gstMatch) {
      gst = gstMatch[1].replace(/\r?\n/g, " ").trim();
    }

    // ── Extract TCS ─────────────────────────────────────────────────────
    let tcs = "0.0";
    const tcsMatch = block.match(
      /TCS\s*(?:\(%\))?\s*-\s*([^\n]*?)(?=\r|\n|GST|Lot Location|State|Lot State|Bid Valid|Start\s*Price|QTY|Quantity|Post\s*Bid|Bid\s*Increment|Category|Lot\s*Description|Lot\s*Name|$)/i,
    );
    if (tcsMatch) {
      tcs = tcsMatch[1].replace(/\r?\n/g, " ").trim();
    }

    // ── Extract Start Price / Market Price ───────────────────────────────
    let lotMarketPrice: string | undefined = undefined;

    const startPriceInrMatch = block.match(
      /Start\s*Price\s*in\s*INR\s*-\s*([\d.]+)/i,
    );
    const startPriceCrMatch = block.match(
      /Start\s*Price\s*\(in\s*INR\s*Cr\.\)\s*:\s*([\d.]+)/i,
    );
    const generalStartPriceMatch = block.match(
      /Start\s*Price\s*(?:in\s*INR|in\s*Cr\.?)?[\s()]*[:.-]?\s*([\d,]+)/i,
    );

    let parsedStartPriceNum: number | null = null;
    if (startPriceInrMatch) {
      parsedStartPriceNum = parseFloat(startPriceInrMatch[1]);
    } else if (startPriceCrMatch) {
      parsedStartPriceNum = parseFloat(startPriceCrMatch[1]) * 10000000;
    } else if (generalStartPriceMatch) {
      const cleanVal = generalStartPriceMatch[1].replace(/,/g, "");
      const parsedVal = parseFloat(cleanVal);
      if (!isNaN(parsedVal)) {
        if (block.toLowerCase().includes("cr.") && parsedVal < 10000) {
          parsedStartPriceNum = parsedVal * 10000000;
        } else {
          parsedStartPriceNum = parsedVal;
        }
      }
    }

    if (
      parsedStartPriceNum !== null &&
      !isNaN(parsedStartPriceNum) &&
      parsedStartPriceNum > 0
    ) {
      const formattedPrice = parsedStartPriceNum.toLocaleString("en-IN");
      const priceUnit = unit || "Lot";
      lotMarketPrice = `₹${formattedPrice} / ${priceUnit}`;
    }

    // ── Extract block attachments (expanded detection) ───────────────────
    const cleanedBlockText = block
      .replace(/\r?\n/g, " ")
      .replace(
        /(Annex_|Photo_|Image_|Img_|Spec_|Doc_|Lot_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
        (_match, p1, p2, p3, p4) => {
          return `${p1}${p2}${p3 || ""}${p4}`;
        },
      );

    const blockMatches = cleanedBlockText.match(ATTACHMENT_PATTERN) || [];
    const attachments = Array.from(new Set(blockMatches)).filter(isLotAttachment);

    // ── Extract block sub-items ─────────────────────────────────────────
    const subItems = parseSubItemsFromText(block);

    let finalQty = qty;
    let finalUnit = unit;
    if (subItems && subItems.length > 0) {
      const currentQtyLower = (qty || "").toLowerCase().trim();
      const currentUnitLower = (unit || "").toLowerCase().trim();
      const isGenericOrGarbage =
        currentQtyLower === "1" ||
        currentQtyLower === "1.0" ||
        currentUnitLower === "lot" ||
        currentUnitLower === "lots" ||
        currentQtyLower.includes("+");

      if (isGenericOrGarbage) {
        finalQty = String(subItems.length);
        finalUnit = "Items";
      }
    }

    let finalDescription = lotDescription;
    if (!finalDescription) {
      finalDescription = lotName || categoryName || "Auction Lot Items";
    } else if (
      lotName &&
      !finalDescription.toLowerCase().includes(lotName.toLowerCase())
    ) {
      finalDescription = `${lotName} - ${finalDescription}`;
    }

    items.push({
      sr,
      description: finalDescription,
      qty: finalQty,
      unit: finalUnit,
      taxRate: `${gst} GST${tcs && tcs !== "0.0" && tcs !== "0" ? " + " + (tcs.endsWith("%") ? tcs : tcs + "%") + " TCS" : ""}`,
      attachments: attachments.length > 0 ? attachments : undefined,
      marketPrice: lotMarketPrice,
      subItems: subItems.length > 0 ? subItems : undefined,
    });
  }

  // Fallback if no lots parsed
  if (items.length === 0) {
    items.push({
      sr: 1,
      description: categoryName || "Auction Lot Items",
      qty: "1",
      unit: "Lot",
      taxRate: "18% GST",
    });
  }

  return items;
}
