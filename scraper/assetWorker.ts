/**
 * Background Asset Worker
 *
 * Polls the `mstc_auctions` table for pending/failed records, downloads
 * their catalog PDFs, extracts images and structured metadata, then
 * updates the database with the results.
 *
 * Fixes applied:
 * - Deduplicated terms-page detection via documentClassifier.
 * - Deduplicated quantity update logic via tryUpdateLotQuantity().
 * - Deduplicated page processing logic via processPageForLotEnrichment().
 * - Memory management: null out buffers after processing.
 * - Improved lot matching: stricter sequential fallback, higher keyword threshold.
 * - Expanded attachment detection beyond photo_/annex_ prefixes.
 * - Performance/Memory: Separate embedding generation from concurrent attachment processing,
 *   pre-computing page embeddings in batch chunks outside the concurrent loop and freeing
 *   ONNX runtime tensor memory explicitly.
 * - Scalability: Replaced local cookies.txt file with database-driven session sharing pattern
 *   via Supabase ocr_cache lookup to eliminate single point of failure.
 */
import fetch from "node-fetch";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import { pipeline, env } from "@xenova/transformers";

// Configure transformers for Node.js environment
env.allowLocalModels = false;
env.useBrowserCache = false;

import {
  MAX_RETRY_COUNT,
  QUEUE_BATCH_SIZE,
  POLL_INTERVAL_MS,
  ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
  MSTC_CATALOG_PDF_ENDPOINT,
  MSTC_ATTACHMENT_ENDPOINT,
  DEFAULT_USER_AGENT,
  CATALOG_DOWNLOAD_TIMEOUT_MS,
} from "./config.js";
import { logger } from "./utils/logger.js";
import { supabase, uploadToStorage } from "./utils/storage.js";
import {
  renderPdfFirstPage,
  extractEmbeddedJpegs,
  renderAndExtractPdfPages,
} from "./utils/pdfUtils.js";
import { parseMstcCatalogText, parseSubItemsFromText } from "./parsers/mstcParser.js";
import type { CatalogSummary } from "./parsers/mstcParser.js";
import { performOcr, shouldPerformOcr } from "./utils/ocrUtils.js";
import { isTermsOrInstructionPage } from "./parsers/documentClassifier.js";

function parsePdfDateTimeToISO(dateTimeStr: string | undefined): string | null {
  if (!dateTimeStr) return null;
  const match = dateTimeStr.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) {
      year += 2000;
    }
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
  }
  return null;
}

import { calculateTotalMarketValue } from "../src/utils/valuationUtils.js";
import { validateCatalogDescriptions } from "../src/utils/mstcHelpers.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const log = logger.child({ module: "assetWorker" });
const workerId = `worker_${randomUUID()}`;

/**
 * Concurrency limiter to run a batch of asynchronous tasks in parallel.
 */
async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrencyLimit: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<any>[] = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p as any);

    if (concurrencyLimit <= tasks.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// Global cache for the embedding pipeline model
let embeddingPipelineCache: any = null;
async function getEmbeddingPipeline() {
  if (!embeddingPipelineCache) {
    embeddingPipelineCache = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }
  return embeddingPipelineCache;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueueRecord {
  id: string;
  mstc_auction_number: string;
  source_pdf_url: string;
  retry_count: number;
  category_name: string | null;
  seller_name: string | null;
  location: string | null;
  raw_materials_text: string | null;
  updated_at?: string;
}

interface ExtractedPage {
  fileName: string;
  pageNumber: number;
  publicUrl: string;
  combinedText: string;
  ocrText: string;
  embedding?: number[];
}

// ─── Shared Helpers (Deduplicated) ───────────────────────────────────────────

/**
 * Check if a lot's quantity is generic/garbage and should be overwritten.
 */
function isGenericQuantity(qty: string, unit: string): boolean {
  const qtyLower = (qty || "").toLowerCase().trim();
  const unitLower = (unit || "").toLowerCase().trim();
  return (
    qtyLower === "1" ||
    qtyLower === "1.0" ||
    unitLower === "lot" ||
    unitLower === "lots" ||
    qtyLower.includes("+")
  );
}

/**
 * Try to update a lot's quantity from extracted OCR data.
 * Only updates when no sub-items were found and current qty is generic.
 *
 * Previously duplicated 3× across the worker.
 */
function tryUpdateLotQuantity(
  lot: any,
  extracted: { qty: string; unit: string } | null,
  subItems: any[] | null,
  jobLog: any,
): void {
  // Skip when sub-items exist — qty will be derived from sub-item count
  if (subItems && subItems.length > 0) return;

  if (
    !extracted ||
    !extracted.qty ||
    extracted.qty === "1" ||
    extracted.qty === "1.0"
  ) {
    return;
  }

  if (isGenericQuantity(lot.qty, lot.unit)) {
    jobLog.info(
      {
        lotSr: lot.sr,
        oldQty: lot.qty,
        oldUnit: lot.unit,
        newQty: extracted.qty,
        newUnit: extracted.unit,
      },
      "Updating lot quantity from OCR/scanned text",
    );
    lot.qty = extracted.qty;
    lot.unit = extracted.unit;
  }
}

/**
 * Merge OCR-extracted sub-items into a lot, avoiding duplicates.
 *
 * Previously duplicated 3× across the worker.
 */
function mergeSubItems(lot: any, subItems: any[]): void {
  if (!subItems || subItems.length === 0) return;
  if (!lot.subItems) {
    lot.subItems = [];
  }
  for (const sub of subItems) {
    if (
      !lot.subItems.some(
        (s: any) => s.sr === sub.sr && s.description === sub.description,
      )
    ) {
      lot.subItems.push(sub);
    }
  }
}

/**
 * Process a single page image for lot enrichment: OCR, sub-item extraction,
 * quantity extraction, and lot matching.
 *
 * Previously the same 30-line block was duplicated 3× across the worker.
 */
export async function processPageForLotEnrichment(
  combinedText: string,
  items: any[],
  attachmentToLots: Map<string, any[]>,
  fileName: string,
  publicUrl: string,
  lotSpecificImagesMap: Record<string, string[]>,
  jobLog: any,
  lotEmbeddings?: Map<string, number[]>,
  lastMatched?: any[],
  pageVector?: number[] | null,
): Promise<{ matched: any[] }> {
  // Use pre-assigned lot mapping first, fall back to text-based matching
  let matched = attachmentToLots.get(fileName) || [];
  if (matched.length === 0) {
    matched = await matchPageToLots(combinedText, items, fileName, lotEmbeddings, lastMatched, pageVector);
  }

  if (matched.length > 1) {
    // Multi-lot page segmentation logic
    const lotPositions: { lot: any; index: number }[] = [];

    for (const lot of matched) {
      const srStr = String(lot.sr).toLowerCase().trim();
      const patterns = [
        new RegExp(`\\blot\\s*(?:no|num|number|#)?\\s*[-.:]?\\s*0*${srStr}\\b`, "i"),
        new RegExp(`\\b(?:sr|sl|s)\\.?\\s*(?:no|num|number)?\\s*[-.:]?\\s*0*${srStr}\\b`, "i"),
      ];

      let earliestIndex = -1;
      for (const pattern of patterns) {
        const match = combinedText.match(pattern);
        if (match && match.index !== undefined) {
          if (earliestIndex === -1 || match.index < earliestIndex) {
            earliestIndex = match.index;
          }
        }
      }

      if (earliestIndex !== -1) {
        lotPositions.push({ lot, index: earliestIndex });
      }
    }

    // Sort by index ascending
    lotPositions.sort((a, b) => a.index - b.index);

    if (lotPositions.length > 1) {
      jobLog.info(
        {
          lotSrs: lotPositions.map((p) => p.lot.sr),
          fileName,
        },
        "Segmenting multi-lot page text into individual sections",
      );

      for (let idx = 0; idx < lotPositions.length; idx++) {
        const current = lotPositions[idx];
        const next = lotPositions[idx + 1];
        const start = current.index;
        const end = next ? next.index : combinedText.length;
        const segmentText = combinedText.substring(start, end);

        const subItems = isTermsOrInstructionPage(segmentText)
          ? []
          : parseSubItemsFromText(segmentText);
        const extracted = extractQuantitiesDetailed(segmentText);

        const lot = current.lot;
        const srStr = String(lot.sr);
        if (!lotSpecificImagesMap[srStr]) {
          lotSpecificImagesMap[srStr] = [];
        }
        lotSpecificImagesMap[srStr].push(publicUrl);

        mergeSubItems(lot, subItems);
        tryUpdateLotQuantity(lot, extracted, subItems, jobLog);
      }
    } else {
      // Fallback: assign to all matched lots (no distinct markers found)
      const subItems = isTermsOrInstructionPage(combinedText)
        ? []
        : parseSubItemsFromText(combinedText);
      const extracted = extractQuantitiesDetailed(combinedText);

      for (const lot of matched) {
        const srStr = String(lot.sr);
        if (!lotSpecificImagesMap[srStr]) {
          lotSpecificImagesMap[srStr] = [];
        }
        lotSpecificImagesMap[srStr].push(publicUrl);

        mergeSubItems(lot, subItems);
        tryUpdateLotQuantity(lot, extracted, subItems, jobLog);
      }
    }
  } else if (matched.length === 1) {
    const lot = matched[0];
    const subItems = isTermsOrInstructionPage(combinedText)
      ? []
      : parseSubItemsFromText(combinedText);
    const extracted = extractQuantitiesDetailed(combinedText);

    const srStr = String(lot.sr);
    if (!lotSpecificImagesMap[srStr]) {
      lotSpecificImagesMap[srStr] = [];
    }
    lotSpecificImagesMap[srStr].push(publicUrl);

    mergeSubItems(lot, subItems);
    tryUpdateLotQuantity(lot, extracted, subItems, jobLog);
  }

  return { matched };
}

// ─── Attachment Processing ───────────────────────────────────────────────────

/**
 * Download a single PDF attachment from the MSTC server.
 */
async function downloadAttachment(
  fileName: string,
  docType: string,
  headers: Record<string, string>,
): Promise<Buffer | null> {
  const fileUrl = `${MSTC_ATTACHMENT_ENDPOINT}?FILE_ID=${fileName}&doc_type=${docType}`;

  const jobLog = log.child({ fileName, docType });
  jobLog.info({}, "Downloading attachment");

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
    );

    try {
      const response = await fetch(fileUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (response.ok) {
        const docBuffer = Buffer.from(await response.arrayBuffer());
        if (docBuffer.toString("utf-8", 0, 4) === "%PDF") {
          clearTimeout(timeoutId);
          return docBuffer;
        }
      } else {
        jobLog.warn(
          { status: response.status, attempt },
          "Attachment download returned non-OK status",
        );
      }
    } catch (e: any) {
      jobLog.warn(
        { errorMessage: e.message, attempt },
        "Network error downloading attachment",
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < maxAttempts) {
      jobLog.info(
        { attempt, nextAttemptDelayMs: 3000 },
        "Retrying attachment download...",
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  return null;
}

/**
 * Fast Levenshtein distance similarity calculation helper.
 */
export function getLevenshteinSimilarity(s1: string, s2: string): number {
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
}


/**
 * Disambiguate multiple keyword/description matches using semantic similarity.
 */
export async function disambiguateLots(
  pageVector: number[] | null,
  matchedLots: any[],
  lotEmbeddings: Map<string, number[]>,
): Promise<any | null> {
  if (!pageVector) return null;
  try {
    const cosineSimilarity = (v1: number[], v2: number[]) => {
      let dot = 0;
      for (let idx = 0; idx < v1.length; idx++) {
        dot += v1[idx] * v2[idx];
      }
      return dot;
    };

    let highestSim = -1;
    let secondHighestSim = -1;
    let bestLot = null;

    for (const lot of matchedLots) {
      const lotVector = lotEmbeddings.get(lot.description || "");
      if (lotVector) {
        const sim = cosineSimilarity(pageVector, lotVector);
        if (sim > highestSim) {
          secondHighestSim = highestSim;
          highestSim = sim;
          bestLot = lot;
        } else if (sim > secondHighestSim) {
          secondHighestSim = sim;
        }
      }
    }

    if (bestLot && highestSim >= 0.50) {
      const diff = highestSim - secondHighestSim;
      if (diff >= 0.05) {
        log.info(
          {
            bestLotSr: bestLot.sr,
            highestSim: highestSim.toFixed(4),
            diff: diff.toFixed(4),
            allMatchedSrs: matchedLots.map((l) => l.sr),
          },
          "Successfully disambiguated description matches via semantic similarity",
        );
        return bestLot;
      }
    }
  } catch (err: any) {
    log.warn({ errorMessage: err.message }, "Error during description matching disambiguation");
  }
  return null;
}

/**
 * Match a rendered PDF page to specific lot items by analyzing text content.
 *
 * Improved matching:
 * - Increased minimum keyword threshold for generic descriptions.
 * - Requires ≥2 absolute keyword matches.
 */
export async function matchPageToLots(
  pageText: string,
  items: any[],
  attachmentName: string,
  lotEmbeddings?: Map<string, number[]>,
  lastMatched?: any[],
  pageVector?: number[] | null,
): Promise<any[]> {
  const matchedLots: any[] = [];
  
  // Clean common OCR replacement typos (like | -> i) and normalize spaces
  const cleanOcrText = pageText
    .replace(/\|/g, "i")
    .toLowerCase()
    .replace(/\s+/g, " ");
    
  const filenameLower = attachmentName.toLowerCase();

  // 1. Check if the filename itself targets a specific lot
  for (const item of items) {
    const srStr = String(item.sr).toLowerCase().trim();
    if (
      filenameLower.includes(`_${srStr}.pdf`) ||
      filenameLower.includes(`_lot_${srStr}`) ||
      filenameLower.includes(`_${srStr}_`)
    ) {
      matchedLots.push(item);
    }
  }
  if (matchedLots.length > 0) return matchedLots;

  // 2. Scan page text for explicit lot serial number (handles leading-zero formats and sl/sl.no/s.no/sr.no)
  for (const item of items) {
    const srStr = String(item.sr).toLowerCase().trim();
    const lotPatterns = [
      new RegExp(
        `\\blot\\s*(?:no|num|number|#)?\\s*[-.:]?\\s*0*${srStr}\\b`,
        "i",
      ),
      new RegExp(
        `\\b(?:sr|sl|s)\\.?\\s*(?:no|num|number)?\\s*[-.:]?\\s*0*${srStr}\\b`,
        "i",
      ),
    ];
    if (lotPatterns.some((p) => p.test(cleanOcrText))) {
      matchedLots.push(item);
    }
  }
  if (matchedLots.length > 0) return matchedLots;

  // 3. Scan page text for description keyword matches (improved thresholds + fuzzy OCR typo resiliency)
  const whitelistedScrapTerms = new Set(["ms", "gi", "ci", "ss", "fe", "cu", "al"]);
  const fillerWords = new Set([
    "as", "per", "annexure", "attached", "items", "and", "the",
    "for", "with", "from", "auction", "lot", "general", "scrap",
    "material", "materials", "miscellaneous", "various",
  ]);

  // Tokenize page words for fuzzy keyword checking
  const pageWords = cleanOcrText
    .split(/[^a-z0-9]/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  for (const item of items) {
    const desc = (item.description || "").toLowerCase();
    const keywords = desc
      .split(/[^a-zA-Z0-9]/)
      .map((w: string) => w.trim())
      .filter((w: string) => (w.length >= 3 || whitelistedScrapTerms.has(w)) && !fillerWords.has(w));

    if (keywords.length > 0) {
      const matchedKeywords = keywords.filter((word: string) => {
        const isWhitelist = whitelistedScrapTerms.has(word);
        
        // Exact match check first
        if (pageWords.includes(word)) return true;
        if (isWhitelist) return false; // whitelist terms must match exactly
        
        // Starts-with check
        const startsWithRx = new RegExp(`\\b${word}[a-z]*\\b`, "i");
        if (startsWithRx.test(cleanOcrText)) return true;

        // Fuzzy match check (Levenshtein similarity >= 0.80 for long keywords) to handle OCR typos
        if (word.length >= 4) {
          for (const pw of pageWords) {
            if (pw.length >= 4 && getLevenshteinSimilarity(word, pw) >= 0.8) {
              return true;
            }
          }
        }
        return false;
      });

      // Require at least 60% overlap, but cap at keywords length and require at least 2 if length >= 2
      const threshold = Math.min(keywords.length, Math.max(2, Math.ceil(keywords.length * 0.6)));
      if (matchedKeywords.length >= threshold) {
        matchedLots.push(item);
      }
    }
  }

  // Disambiguation for description keyword matches
  if (matchedLots.length > 1 && lotEmbeddings && lotEmbeddings.size > 0) {
    const bestMatch = await disambiguateLots(pageVector ?? null, matchedLots, lotEmbeddings);
    if (bestMatch) {
      return [bestMatch];
    }
  }

  if (matchedLots.length > 0) return matchedLots;

  // 4. Continuation fallback check: if this page has no matches but the previous page in this attachment did,
  // we assume it is a continuation of those same lots.
  // Check this BEFORE running semantic similarity to avoid wasting CPU.
  if (lastMatched && lastMatched.length > 0) {
    log.info(
      { continuationLots: lastMatched.map((l) => l.sr) },
      "Applying continuation page fallback match",
    );
    return [...lastMatched];
  }

  // 5. Semantic Similarity fallback matching
  if (pageVector && lotEmbeddings && lotEmbeddings.size > 0 && cleanOcrText.trim().length > 10) {
    try {
      const cosineSimilarity = (v1: number[], v2: number[]) => {
        let dot = 0;
        for (let idx = 0; idx < v1.length; idx++) {
          dot += v1[idx] * v2[idx];
        }
        return dot;
      };

      const semanticMatches: { lot: any; sim: number }[] = [];
      for (const item of items) {
        const lotVector = lotEmbeddings.get(item.description || "");
        if (lotVector) {
          const sim = cosineSimilarity(pageVector, lotVector);
          if (sim >= 0.55) {
            semanticMatches.push({ lot: item, sim });
          }
        }
      }

      // Disambiguate semantic matches
      if (semanticMatches.length > 0) {
        semanticMatches.sort((a, b) => b.sim - a.sim);
        const best = semanticMatches[0];

        if (semanticMatches.length > 1) {
          const second = semanticMatches[1];
          const diff = best.sim - second.sim;
          if (diff >= 0.05) {
            log.info(
              { lotSr: best.lot.sr, similarity: best.sim.toFixed(4), diff: diff.toFixed(4) },
              "Single best semantic match selected after disambiguation",
            );
            matchedLots.push(best.lot);
          } else {
            // Keep both if they are very close
            matchedLots.push(best.lot, second.lot);
          }
        } else {
          matchedLots.push(best.lot);
        }
      }
    } catch (err: any) {
      log.warn({ errorMessage: err.message }, "Error during semantic page-to-lot matching");
    }
  }

  return matchedLots;
}

/**
 * Robustly extract quantities and units from text content.
 */
function extractQuantitiesDetailed(
  text: string,
): { qty: string; unit: string } {
  const matches: { value: number; unit: string; index: number }[] = [];

  // 1. Match "QTY: 21,172NOS", "QTY: 296.800KGS", "(Qty: 17 nos.)"
  const qtyRegex =
    /(?:qty|quantity|quantities)\s*[:.-]?\s*([\d.,]+)\s*([A-Za-z]+)?/gi;
  let match;
  while ((match = qtyRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(val)) {
      matches.push({
        value: val,
        unit: (match[2] || "NOS").toUpperCase().trim(),
        index: match.index,
      });
    }
  }

  // 2. Match suffix-only units for count types
  const countUnitRegex =
    /\b([\d.,]+)\s*(nos|pcs|units|sets|pc|items|item)\b/gi;
  const prefixRejectRegex = /\b(?:lot|sl|sr|s\.?no|no)\b[\s.:-]*$/i;
  while ((match = countUnitRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(val)) {
      const prefixText = text.substring(0, match.index);
      if (!prefixRejectRegex.test(prefixText)) {
        matches.push({
          value: val,
          unit: match[2].toUpperCase().trim(),
          index: match.index,
        });
      }
    }
  }

  if (matches.length === 0) {
    return { qty: "1", unit: "Lot" };
  }

  // Deduplicate overlapping matches within 15 characters
  matches.sort((a, b) => a.index - b.index);
  const uniqueMatches: typeof matches = [];
  for (const m of matches) {
    const isOverlapping = uniqueMatches.some(
      (um) => Math.abs(um.index - m.index) < 15,
    );
    if (!isOverlapping) {
      uniqueMatches.push(m);
    }
  }

  // Group and sum by standardized unit
  const groups: { [unit: string]: number } = {};
  for (const m of uniqueMatches) {
    let u = m.unit;
    if (u === "KG") u = "KGS";
    if (u === "MT") u = "MTS";
    if (u === "PC") u = "PCS";
    if (u === "LTR") u = "LTRS";
    if (u === "TON") u = "TONS";
    if (u === "ITEM") u = "ITEMS";
    groups[u] = (groups[u] || 0) + m.value;
  }

  const groupEntries = Object.entries(groups);
  if (groupEntries.length === 0) {
    return { qty: "1", unit: "Lot" };
  }

  if (groupEntries.length === 1) {
    const [u, totalVal] = groupEntries[0];
    const qty = Number.isInteger(totalVal)
      ? totalVal.toLocaleString("en-IN")
      : totalVal.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        });
    return { qty, unit: u };
  } else {
    const qty = groupEntries
      .map(([u, totalVal]) => {
        const formattedVal = Number.isInteger(totalVal)
          ? totalVal.toLocaleString("en-IN")
          : totalVal.toLocaleString("en-IN", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 3,
            });
        return `${formattedVal} ${u}`;
      })
      .join(" + ");
    return { qty, unit: "" };
  }
}

/**
 * Check if an attachment filename is a lot-specific document.
 * Expanded beyond photo_/annex_ to catch more naming conventions.
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

/**
 * Extract attachment file references from catalog text,
 * download each, extract/render images, and upload them to storage.
 */
async function extractAndProcessLotDocuments(
  catalogText: string,
  sanitizedAuctionNum: string,
  headers: Record<string, string>,
  items: any[] = [],
  lotEmbeddings?: Map<string, number[]>,
): Promise<{
  imageUrls: string[];
  attachmentMap: Record<string, string[]>;
  lotSpecificImagesMap: Record<string, string[]>;
  eligibilityNotes: string[];
}> {
  // Reconstruct filenames if there are newlines or spaces
  const cleanedText = catalogText
    .replace(/\r?\n/g, " ")
    .replace(
      /(Annex_|Photo_|Image_|Img_|Spec_|Doc_|Lot_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
      (_match, p1, p2, p3, p4) => {
        return `${p1}${p2}${p3 || ""}${p4}`;
      },
    );

  const matches = cleanedText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
  const uniqueAttachments = Array.from(new Set(matches)).filter(isLotAttachment);

  const imageUrls: string[] = [];
  const attachmentMap: Record<string, string[]> = {};
  const lotSpecificImagesMap: Record<string, string[]> = {};
  const eligibilityNotes: string[] = [];

  if (uniqueAttachments.length === 0) {
    return { imageUrls, attachmentMap, lotSpecificImagesMap, eligibilityNotes };
  }

  log.info(
    { count: uniqueAttachments.length, auctionNumber: sanitizedAuctionNum },
    "Found lot attachments to process",
  );

  // Build reverse map: attachment filename → pre-assigned lot item(s)
  const attachmentToLots = new Map<string, any[]>();
  for (const item of items) {
    if (item.attachments && Array.isArray(item.attachments)) {
      for (const att of item.attachments) {
        const existing = attachmentToLots.get(att) || [];
        existing.push(item);
        attachmentToLots.set(att, existing);
      }
    }
  }

  // Pass 1: Extract text, upload images, and release buffers concurrently
  const extractedPagesMap = new Map<string, ExtractedPage[]>();

  const tasks = uniqueAttachments.map((fileName, i) => async () => {
    const pagesForAttachment: ExtractedPage[] = [];

    // Determine doc_type
    const primaryType = fileName.toLowerCase().startsWith("photo_")
      ? "attached_photo"
      : "attached_annex";
    const fallbackType =
      primaryType === "attached_photo" ? "attached_annex" : "attached_photo";

    let docBuffer = await downloadAttachment(fileName, primaryType, headers);
    if (!docBuffer) {
      log.info({ fileName, fallbackType }, "Trying fallback doc_type");
      docBuffer = await downloadAttachment(fileName, fallbackType, headers);
    }

    if (!docBuffer) {
      log.warn({ fileName }, "Could not retrieve valid PDF for attachment");
      return;
    }

    log.info(
      { fileName, sizeBytes: docBuffer.length },
      "Attachment retrieved, processing images",
    );

    // 1. Try to render all pages
    const renderedPages = await renderAndExtractPdfPages(docBuffer, 20);
    if (renderedPages.length > 0) {
      // Release raw PDF buffer immediately as we have rendered the pages
      docBuffer = null as any;

      log.info(
        { fileName, pageCount: renderedPages.length },
        "Rendered attachment pages",
      );

      for (let pIdx = 0; pIdx < renderedPages.length; pIdx++) {
        const page = renderedPages[pIdx];
        try {
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_page_${page.pageNumber}.jpg`;
          const publicUrl = await uploadToStorage(
            imgPath,
            page.imageBuffer,
            "image/jpeg",
          );

          // Smart OCR: only run OCR when selectable text is insufficient
          let ocrText = "";
          if (shouldPerformOcr(page.text)) {
            ocrText = await performOcr(page.imageBuffer);
          }
          const combinedText = `${page.text || ""}\n${ocrText}`;

          pagesForAttachment.push({
            fileName,
            pageNumber: page.pageNumber,
            publicUrl,
            combinedText,
            ocrText,
          });

          // Memory management: null out buffer and text after processing
          (page as any).imageBuffer = null;
          (page as any).text = null;
        } catch (uploadErr: any) {
          log.warn(
            { errorMessage: uploadErr.message, pageNumber: page.pageNumber },
            "Failed to process rendered page image",
          );
        }
      }
    } else {
      // 2. Fallback: extract embedded JPEGs
      const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
      // Release raw PDF buffer immediately after extraction
      docBuffer = null as any;

      if (embeddedJpegs.length > 0) {
        log.info(
          { fileName, imageCount: embeddedJpegs.length },
          "Extracted embedded images from attachment (fallback)",
        );
        for (let j = 0; j < embeddedJpegs.length; j++) {
          try {
            const imgBuffer = embeddedJpegs[j];
            const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_img_${j}.jpg`;
            const publicUrl = await uploadToStorage(
              imgPath,
              imgBuffer,
              "image/jpeg",
            );

            // Always run OCR on embedded image fallbacks (no selectable text exists)
            const ocrText = await performOcr(imgBuffer);
            const combinedText = ocrText;

            pagesForAttachment.push({
              fileName,
              pageNumber: j + 1,
              publicUrl,
              combinedText,
              ocrText,
            });
          } catch (uploadErr: any) {
            log.warn(
              { errorMessage: uploadErr.message },
              "Failed to upload extracted attachment image",
            );
          }
        }
      }
    }

    extractedPagesMap.set(fileName, pagesForAttachment);
  });

  // Concurrently process attachments with a limit of 3 to optimize worker performance
  await limitConcurrency(tasks, 3);

  // Pass 2: Batch generate embeddings for all extracted page texts outside concurrent loop, in chunks
  const allFlatPages: ExtractedPage[] = [];
  for (const fileName of uniqueAttachments) {
    const pages = extractedPagesMap.get(fileName) || [];
    allFlatPages.push(...pages);
  }

  const pagesToEmbed = allFlatPages.filter(p => p.combinedText.trim().length > 10);
  if (pagesToEmbed.length > 0 && lotEmbeddings && lotEmbeddings.size > 0) {
    try {
      const texts = pagesToEmbed.map(p => p.combinedText.toLowerCase().replace(/\s+/g, " "));
      log.info(
        { count: texts.length },
        "Batch generating embeddings for attachment pages in chunked sequence",
      );
      const extractor = await getEmbeddingPipeline();
      
      const chunkSize = 16;
      for (let i = 0; i < texts.length; i += chunkSize) {
        const chunkTexts = texts.slice(i, i + chunkSize);
        let chunkOutput = await extractor(chunkTexts, {
          pooling: "mean",
          normalize: true,
        });

        const batchSize = chunkTexts.length;
        const dim = chunkOutput.dims ? chunkOutput.dims[1] : (chunkOutput.data.length / batchSize);
        const data = chunkOutput.data as any;

        for (let idx = 0; idx < batchSize; idx++) {
          const vector = Array.from(data.subarray(idx * dim, (idx + 1) * dim)) as number[];
          pagesToEmbed[i + idx].embedding = vector;
        }

        // Null out chunk-specific tensor references to allow GC immediately
        chunkOutput = null;
      }
    } catch (embedErr: any) {
      log.warn(
        { errorMessage: embedErr.message },
        "Failed to batch generate embeddings for attachment pages",
      );
    }
  }

  // Pass 3: Process the pages using pre-computed embeddings
  for (const fileName of uniqueAttachments) {
    const pages = extractedPagesMap.get(fileName) || [];
    const lotImageUrls: string[] = [];
    const pageUrls: string[] = [];
    const pageMatches: any[][] = [];
    let lastMatched: any[] = [];

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];
      imageUrls.push(page.publicUrl);
      lotImageUrls.push(page.publicUrl);
      pageUrls.push(page.publicUrl);

      const { matched } = await processPageForLotEnrichment(
        page.combinedText,
        items,
        attachmentToLots,
        fileName,
        page.publicUrl,
        lotSpecificImagesMap,
        log,
        lotEmbeddings,
        lastMatched,
        page.embedding || null,
      );
      pageMatches.push(matched);

      if (matched && matched.length > 0) {
        lastMatched = matched;
      }

      if (matched.length > 0) {
        log.info(
          {
            pageNumber: page.pageNumber,
            matchedLots: matched.map((m) => m.sr),
          },
          "Mapped rendered page to lot(s)",
        );
      }
    }

    // Improved sequential fallback:
    const hasSpecificMatches = pageMatches.some((m) => m.length > 0);
    if (
      !hasSpecificMatches &&
      pages.length === items.length &&
      items.length > 0
    ) {
      const hasLotReferences = pages.some(
        (p) => p.combinedText && /lot\s*no/i.test(p.combinedText),
      );
      if (!hasLotReferences) {
        log.info(
          {
            fileName,
            pageCount: pages.length,
            itemsCount: items.length,
          },
          "No matches found, mapping pages sequentially (standalone photos confirmed)",
        );
        for (let pIdx = 0; pIdx < pageUrls.length; pIdx++) {
          const item = items[pIdx];
          const srStr = String(item.sr);
          if (!lotSpecificImagesMap[srStr]) {
            lotSpecificImagesMap[srStr] = [];
          }
          lotSpecificImagesMap[srStr].push(pageUrls[pIdx]);
        }
      } else {
        log.info(
          { fileName },
          "Skipping sequential fallback — pages contain mixed lot references",
        );
      }
    }

    attachmentMap[fileName] = lotImageUrls;
  }

  // Final pass: derive lot quantity from sub-items when current qty is generic
  for (const item of items) {
    if (item.subItems && item.subItems.length > 0) {
      if (isGenericQuantity(item.qty, item.unit)) {
        log.info(
          {
            lotSr: item.sr,
            oldQty: item.qty,
            oldUnit: item.unit,
            subItemCount: item.subItems.length,
          },
          "Deriving lot quantity from sub-item count",
        );
        item.qty = String(item.subItems.length);
        item.unit = "Items";
      }
    }
  }

  return {
    imageUrls,
    attachmentMap,
    lotSpecificImagesMap,
    eligibilityNotes: Array.from(new Set(eligibilityNotes)),
  };
}

// ─── Queue Pipeline ──────────────────────────────────────────────────────────

/**
 * Read session cookies from database (ocr_cache) for MSTC authentication.
 */
async function loadSessionCookies(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("ocr_cache")
      .select("ocr_text")
      .eq("buffer_hash", "SYSTEM_SESSION_COOKIES")
      .maybeSingle();

    if (error) {
      log.warn({ errorMessage: error.message }, "Failed to query session cookies from database");
      return null;
    }
    if (data?.ocr_text) {
      return data.ocr_text.trim();
    }
  } catch (cookieErr: any) {
    log.warn({ errorMessage: cookieErr.message }, "Failed to read session cookies");
  }
  return null;
}

/**
 * Build HTTP headers for MSTC requests.
 */
async function buildMstcHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const cookies = await loadSessionCookies();
  if (cookies) {
    headers["Cookie"] = cookies;
  }

  return headers;
}

/**
 * Process a single queue record: download, parse, extract, and update.
 */
export async function processRecord(record: QueueRecord): Promise<void> {
  const jobLog = log.child({ auctionNumber: record.mstc_auction_number });

  jobLog.info({}, "Starting document processing");

  const headers = await buildMstcHeaders();

  let fileBuffer: Buffer | null = null;
  let catalogUrl = "";
  const sanitizedAuctionNum = record.id;
  const storagePath = `mstc-catalogs/${sanitizedAuctionNum}.pdf`;

  // 1. Try to download catalog PDF from storage cache first to save bandwidth and prevent rate-limits
  try {
    jobLog.info({ storagePath }, "Checking storage cache for existing catalog PDF");
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from("auction_documents")
      .download(storagePath);

    if (!downloadError && downloadData) {
      fileBuffer = Buffer.from(await downloadData.arrayBuffer());
      catalogUrl = supabase.storage
        .from("auction_documents")
        .getPublicUrl(storagePath).data.publicUrl;
      jobLog.info({}, "Catalog PDF successfully retrieved from Supabase Storage cache");
    }
  } catch (err: any) {
    jobLog.warn({ errorMessage: err.message }, "Error checking Storage cache, falling back to MSTC");
  }

  // 2. If not found in cache, download from MSTC
  if (!fileBuffer) {
    const url = new URL(record.source_pdf_url);
    const aucId = url.searchParams.get("auc") || "";

    const formData = new URLSearchParams();
    formData.append("auc", aucId);
    formData.append("cat", "0");
    formData.append("sell", "0");

    let payloadResponse;
    const fetchAttempts = 3;
    let lastFetchError: any = null;

    for (let attempt = 1; attempt <= fetchAttempts; attempt++) {
      try {
        payloadResponse = await fetch(MSTC_CATALOG_PDF_ENDPOINT, {
          method: "POST",
          body: formData,
          headers,
          timeout: CATALOG_DOWNLOAD_TIMEOUT_MS,
        } as any);
        lastFetchError = null;
        break;
      } catch (fetchErr: any) {
        lastFetchError = fetchErr;
        jobLog.warn(
          { attempt, errorMessage: fetchErr.message },
          "PDF catalog fetch failed, retrying...",
        );
        if (attempt < fetchAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    if (lastFetchError) {
      throw lastFetchError;
    }

    if (!payloadResponse || !payloadResponse.ok) {
      const status = payloadResponse ? payloadResponse.status : 0;
      let errMessage = `Catalog download failed with status ${status}`;
      if (status >= 500) {
        errMessage = `MSTC Server Error: MSTC returned HTTP ${status} (Internal Server Error / IBM HTTP Server)`;
      }
      throw new Error(errMessage);
    }

    fileBuffer = Buffer.from(await payloadResponse.arrayBuffer());

    // Validate PDF structure
    if (fileBuffer.toString("utf-8", 0, 4) !== "%PDF") {
      const preview = fileBuffer.toString("utf-8", 0, 1000);
      if (
        preview.includes("IBM_HTTP_Server") ||
        preview.includes("Internal Server Error")
      ) {
        throw new Error(
          "MSTC Server Error: IBM HTTP Server returned 500 (Internal Server Error) instead of a PDF catalog.",
        );
      }
      if (
        preview.includes("session") ||
        preview.includes("timeout") ||
        preview.includes("login")
      ) {
        throw new Error(
          "Session expired or invalid. Please run the scraper again to renew cookies.",
        );
      }
      throw new Error("Downloaded file is not a valid PDF.");
    }

    // Upload catalog PDF to storage
    catalogUrl = await uploadToStorage(
      storagePath,
      fileBuffer,
      "application/pdf",
    );
  }

  // 1. Render First Page Preview
  jobLog.info({}, "Rendering PDF first page preview");
  let previewImageUrl: string | null = null;
  const previewBuffer = await renderPdfFirstPage(fileBuffer);
  if (previewBuffer) {
    try {
      previewImageUrl = await uploadToStorage(
        `mstc-previews/${sanitizedAuctionNum}.jpg`,
        previewBuffer,
        "image/jpeg",
      );
      jobLog.info({ previewImageUrl }, "Uploaded first page preview");
    } catch (previewErr: any) {
      jobLog.warn(
        { errorMessage: previewErr.message },
        "Failed to upload preview image",
      );
    }
  }

  // 2. Extract Embedded Images from main catalog
  jobLog.info({}, "Checking for embedded images in catalog PDF");
  const embeddedImages = extractEmbeddedJpegs(fileBuffer);
  const extractedImageUrls: string[] = [];

  if (embeddedImages.length > 0) {
    jobLog.info(
      { imageCount: embeddedImages.length },
      "Found embedded images, uploading",
    );
    for (let i = 0; i < embeddedImages.length; i++) {
      try {
        const publicUrl = await uploadToStorage(
          `mstc-extracted-images/${sanitizedAuctionNum}_img_${i}.jpg`,
          embeddedImages[i],
          "image/jpeg",
        );
        extractedImageUrls.push(publicUrl);
      } catch (imgErr: any) {
        jobLog.warn(
          { imageIndex: i, errorMessage: imgErr.message },
          "Failed to upload extracted catalog image",
        );
      }
    }
  }

  // 3. Parse PDF text and generate structured catalog summary
  let rawMaterialsText = record.raw_materials_text;
  let parsedStartTime: string | undefined;
  let parsedCloseTime: string | undefined;
  try {
    jobLog.info({}, "Parsing PDF text content");
    const parsedPdf = await pdf(fileBuffer);

    // Release main PDF buffer for GC
    fileBuffer = null;

    if (parsedPdf?.text) {
      const summaryObj: CatalogSummary = parseMstcCatalogText(
        parsedPdf.text,
        record.category_name || "",
        record.seller_name || "",
        record.location || "",
      );
      parsedStartTime = summaryObj.auctionStartTime;
      parsedCloseTime = summaryObj.auctionCloseTime;

      // Initialize item.images and pre-compute description embeddings
      const lotEmbeddings = new Map<string, number[]>();
      if (summaryObj.items && Array.isArray(summaryObj.items)) {
        for (const item of summaryObj.items) {
          item.images = [];
        }

        try {
          const uniqueLotDescriptions = Array.from(
            new Set(summaryObj.items.map((it) => it.description || ""))
          ).filter(Boolean);

          if (uniqueLotDescriptions.length > 0) {
            jobLog.info(
              { count: uniqueLotDescriptions.length },
              "Pre-computing lot description embeddings in batch for semantic matching",
            );
            const extractor = await getEmbeddingPipeline();
            let output = await extractor(uniqueLotDescriptions, {
              pooling: "mean",
              normalize: true,
            });

            const batchSize = uniqueLotDescriptions.length;
            const dim = output.dims ? output.dims[1] : (output.data.length / batchSize);
            let data = output.data as any;

            for (let idx = 0; idx < batchSize; idx++) {
              const desc = uniqueLotDescriptions[idx];
              const vector = Array.from(data.subarray(idx * dim, (idx + 1) * dim)) as number[];
              lotEmbeddings.set(desc, vector);
            }

            // Explicitly clear references
            output = null;
            data = null;
          }
        } catch (err: any) {
          jobLog.warn(
            { errorMessage: err.message },
            "Failed to pre-compute lot description embeddings",
          );
        }
      }

      // Process attachments (passing pre-computed lotEmbeddings)
      let attachmentImageUrls: string[] = [];
      let attachmentMap: Record<string, string[]> = {};
      try {
        const result = await extractAndProcessLotDocuments(
          parsedPdf.text,
          sanitizedAuctionNum,
          headers,
          summaryObj.items || [],
          lotEmbeddings,
        );
        attachmentImageUrls = result.imageUrls;
        attachmentMap = result.attachmentMap;
        if (attachmentImageUrls.length > 0) {
          extractedImageUrls.push(...attachmentImageUrls);
          jobLog.info(
            { attachmentImageCount: attachmentImageUrls.length },
            "Extracted and uploaded lot attachment images with OCR",
          );
        }
        if (result.eligibilityNotes && result.eligibilityNotes.length > 0) {
          if (!summaryObj.eligibility) {
            summaryObj.eligibility = [];
          }
          for (const note of result.eligibilityNotes) {
            if (!summaryObj.eligibility.includes(note)) {
              summaryObj.eligibility.push(note);
            }
          }
        }
      } catch (attErr: any) {
        jobLog.warn(
          { errorMessage: attErr.message },
          "Failed to process lot attachments",
        );
      }

      // Map lot-specific images from the attachment map
      if (summaryObj.items && Array.isArray(summaryObj.items)) {
        for (const item of summaryObj.items) {
          if (!item.images) {
            item.images = [];
          }
          if (item.attachments && Array.isArray(item.attachments)) {
            for (const attName of item.attachments) {
              const urls = attachmentMap[attName];
              if (urls && urls.length > 0) {
                for (const imgUrl of urls) {
                  if (!item.images.includes(imgUrl)) {
                    item.images.push(imgUrl);
                  }
                }
              }
            }
          }
        }
      }

      // Inject preview and extracted images
      summaryObj.preview_image_url = previewImageUrl;
      summaryObj.extracted_images = extractedImageUrls;

      // Calculate total market price valuation
      try {
        const totalMarketValue = calculateTotalMarketValue(
          summaryObj.items || [],
          record.category_name || "",
        );
        summaryObj.totalMarketValue = totalMarketValue;
        jobLog.info(
          { totalMarketValue },
          "Calculated total market value for catalog",
        );
      } catch (valErr: any) {
        jobLog.warn(
          { errorMessage: valErr.message },
          "Failed to calculate total market value",
        );
      }

      // Run catalog validation check for improper/confusing lot descriptions
      try {
        const validation = validateCatalogDescriptions(summaryObj.items || [], record.category_name || "");
        if (validation.needsReview) {
          summaryObj.needsReview = true;
          summaryObj.reviewReason = validation.reason;
          jobLog.warn(
            { reason: validation.reason },
            "Catalog flagged for admin review due to improper/confusing lot descriptions",
          );
        } else {
          summaryObj.needsReview = false;
          summaryObj.reviewReason = "";
        }
      } catch (validationErr: any) {
        jobLog.warn(
          { errorMessage: validationErr.message },
          "Failed to validate catalog descriptions",
        );
      }

      rawMaterialsText = JSON.stringify(summaryObj);
      jobLog.info(
        { summaryLength: rawMaterialsText.length },
        "PDF parsed successfully",
      );
    }
  } catch (parseErr: any) {
    jobLog.warn(
      { errorMessage: parseErr.message },
      "Failed to parse PDF text",
    );
  }

  // Generate AI Semantic Embedding vector
  let embeddingStr: string | null = null;
  try {
    const textToEmbed =
      `${record.category_name || ""} ${rawMaterialsText || ""}`.trim();
    if (textToEmbed.length >= 5) {
      jobLog.info({}, "Generating AI embedding vector for semantic search");
      const extractor = await getEmbeddingPipeline();
      let output = await extractor(textToEmbed, {
        pooling: "mean",
        normalize: true,
      });
      const vector = Array.from(output.data);
      embeddingStr = `[${vector.join(",")}]`;

      // Null out tensor reference to allow GC
      output = null;
    }
  } catch (embedErr: any) {
    jobLog.warn(
      { errorMessage: embedErr.message },
      "Failed to generate AI embedding vector",
    );
  }

  // Update record as completed
  const updatePayload: any = {
    asset_status: "completed",
    sanitized_document_path: catalogUrl,
    raw_materials_text: rawMaterialsText,
    error_log: null,
    updated_at: new Date().toISOString(),
  };

  if (parsedStartTime) {
    const isoStart = parsePdfDateTimeToISO(parsedStartTime);
    if (isoStart) {
      updatePayload.opening_date = isoStart;
    }
  }
  if (parsedCloseTime) {
    const isoClose = parsePdfDateTimeToISO(parsedCloseTime);
    if (isoClose) {
      updatePayload.closing_date = isoClose;
    }
  }

  if (embeddingStr) {
    updatePayload.embedding = embeddingStr;
  }

  await supabase
    .from("mstc_auctions")
    .update(updatePayload)
    .eq("id", record.id);

  // Log download event
  await supabase.from("audit_logs").insert({
    action: "mstc_auction_downloaded",
    entity_type: "mstc_auction",
    entity_id: record.id,
    details: {
      mstc_auction_number: record.mstc_auction_number,
      sanitized_document_path: catalogUrl,
    },
  });

  jobLog.info({}, "Document processing completed successfully");
}

/**
 * Poll the queue for pending records and process them.
 */
async function runAssetPipelineQueue(): Promise<void> {
  // Atomically claim a batch of eligible records via custom RPC to prevent worker claim races
  const { data: claimedRecords, error: claimError } = await supabase
    .rpc("claim_mstc_auctions_batch", {
      p_worker_id: workerId,
      p_batch_size: QUEUE_BATCH_SIZE,
      p_max_retry_count: MAX_RETRY_COUNT,
    });

  if (claimError) {
    log.error(
      { errorMessage: claimError.message },
      "Queue claiming failed via RPC",
    );
    return;
  }

  if (!claimedRecords || claimedRecords.length === 0) {
    return;
  }

  log.info(
    {
      batchSize: claimedRecords.length,
    },
    "Processing claimed queue batch",
  );

  for (const record of claimedRecords as QueueRecord[]) {
    try {
      await processRecord(record);
    } catch (jobError: any) {
      const nextRetryCount = record.retry_count + 1;
      const reachedMaxRetries = nextRetryCount >= MAX_RETRY_COUNT;

      log.error(
        {
          auctionNumber: record.mstc_auction_number,
          retryCount: nextRetryCount,
          reachedMaxRetries,
          errorMessage: jobError.message,
        },
        "Record processing failed",
      );

      await supabase
        .from("mstc_auctions")
        .update({
          asset_status: reachedMaxRetries ? "failed" : "pending",
          retry_count: nextRetryCount,
          error_log: `[Retry ${nextRetryCount}] ${jobError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      await supabase.from("audit_logs").insert({
        action: "mstc_auction_failed",
        entity_type: "mstc_auction",
        entity_id: record.id,
        details: {
          mstc_auction_number: record.mstc_auction_number,
          retry_count: nextRetryCount,
          reached_max_limit: reachedMaxRetries,
          error: jobError.message,
        },
      });
    }
  }
}

// ─── Worker Entry Point ──────────────────────────────────────────────────────

export async function startWorker(): Promise<void> {
  log.info(
    { pollIntervalMs: POLL_INTERVAL_MS },
    "Background Worker Service started",
  );

  while (true) {
    try {
      await runAssetPipelineQueue();
    } catch (err: any) {
      log.error({ errorMessage: err.message }, "Worker loop iteration failed");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export { runAssetPipelineQueue };

// Run automatically if this is the main entry file
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("assetWorker.ts") ||
    process.argv[1].endsWith("assetWorker.js"));

if (isMain) {
  startWorker();
}