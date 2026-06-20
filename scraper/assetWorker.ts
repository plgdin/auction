/**
 * Background Asset Worker
 *
 * Polls the `mstc_auctions` table for pending/failed records, downloads
 * their catalog PDFs, extracts images and structured metadata, then
 * updates the database with the results.
 *
 * This file is the queue coordinator only — all domain logic lives in
 * dedicated modules under `parsers/` and `utils/`.
 */
import fetch from "node-fetch";
import * as fs from "fs";
import { createRequire } from "module";
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
import { renderPdfFirstPage, extractEmbeddedJpegs, renderAndExtractPdfPages } from "./utils/pdfUtils.js";
import { parseMstcCatalogText, parseSubItemsFromText } from "./parsers/mstcParser.js";
import type { CatalogSummary } from "./parsers/mstcParser.js";
import { performOcr } from "./utils/ocrUtils.js";
import { calculateTotalMarketValue } from "../src/utils/valuationUtils.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const log = logger.child({ module: "assetWorker" });

// Global cache for the embedding pipeline model
let embeddingPipelineCache: any = null;
async function getEmbeddingPipeline() {
  if (!embeddingPipelineCache) {
    embeddingPipelineCache = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingPipelineCache;
}

/**
 * Calculates exponential backoff cooldown delay in milliseconds.
 * - Attempt 1 retry (retry_count = 1): wait 1 minute
 * - Attempt 2 retry (retry_count = 2): wait 5 minutes
 * - Attempt 3 retry (retry_count = 3): wait 15 minutes
 * - Attempt 4+ retry (retry_count >= 4): wait 30 minutes
 */
function getRetryDelayMs(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const backoffMinutes = [1, 5, 15, 30];
  const index = Math.min(retryCount - 1, backoffMinutes.length - 1);
  return backoffMinutes[index] * 60 * 1000;
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
      jobLog.info({ attempt, nextAttemptDelayMs: 3000 }, "Retrying attachment download...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  return null;
}

/**
 * Extract attachment file references from the parsed catalog text,
 * download each, extract/render images, and upload them to storage.
 */
/**
 * Helper to match a rendered PDF page to specific lot items by analyzing text content.
 */
function matchPageToLots(
  pageText: string,
  items: any[],
  attachmentName: string
): any[] {
  const matchedLots: any[] = [];
  const normalizedText = pageText.toLowerCase().replace(/\s+/g, " ");
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
  if (matchedLots.length > 0) {
    return matchedLots;
  }

  // 2. Scan page text for explicit lot serial number, e.g. "lot no. 1", "lot - A-1"
  for (const item of items) {
    const srStr = String(item.sr).toLowerCase().trim();
    const lotPatterns = [
      new RegExp(`\\blot\\s*(?:no|num|number)?\\s*[-.:]?\\s*${srStr}\\b`, "i"),
      new RegExp(`\\bsr\\.?\\s*(?:no|num|number)?\\s*[-.:]?\\s*${srStr}\\b`, "i")
    ];
    if (lotPatterns.some(p => p.test(normalizedText))) {
      matchedLots.push(item);
    }
  }
  if (matchedLots.length > 0) {
    return matchedLots;
  }

  // 3. Scan page text for description keyword matches
  for (const item of items) {
    const desc = (item.description || "").toLowerCase();
    const fillerWords = new Set(["as", "per", "annexure", "attached", "items", "and", "the", "for", "with", "from"]);
    const keywords = desc
      .split(/[^a-zA-Z0-9]/)
      .map((w: string) => w.trim())
      .filter((w: string) => w.length >= 3 && !fillerWords.has(w));

    if (keywords.length > 0) {
      const matchedKeywords = keywords.filter((word: string) => normalizedText.includes(word));
      // Require matching at least 50% of keywords, with a minimum of 1
      if (matchedKeywords.length >= Math.max(1, Math.ceil(keywords.length * 0.5))) {
        matchedLots.push(item);
      }
    }
  }

  return matchedLots;
}

/**
 * Extract attachment file references from the parsed catalog text,
 * download each, extract/render images, and upload them to storage.
 * Maps images to specific lots if text matches are found.
 */
/**
 * Robustly extract quantities and units from text content.
 * Matches both prefixed patterns (e.g. Qty: 17 nos) and count suffix-only patterns (e.g. 55 Nos).
 */
function extractQuantitiesDetailed(text: string): { qty: string; unit: string } {
  const matches: { value: number; unit: string; index: number }[] = [];
  
  // 1. Match "QTY: 21,172NOS", "QTY: 296.800KGS", "(Qty: 17 nos.)"
  const qtyRegex = /(?:qty|quantity|quantities)\s*[:.-]?\s*([\d\.,]+)\s*([A-Za-z]+)?/gi;
  let match;
  while ((match = qtyRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val)) {
      matches.push({
        value: val,
        unit: (match[2] || 'NOS').toUpperCase().trim(),
        index: match.index
      });
    }
  }

  // 2. Match suffix-only units for count types only (e.g. "55 Nos", "10 Pcs")
  // Weight/volume/dimensions must be explicitly prefixed with QTY: to avoid matching capacities (e.g. "50 Kg bags")
  // Exclude numbers that are preceded by serial/lot indicators (e.g. "Lot No. 5 Nos", "Sl. No. 10 Nos") to prevent lot numbers from overriding quantities.
  const countUnitRegex = /\b([\d\.,]+)\s*(nos|pcs|units|sets|pc|items|item)\b/gi;
  const prefixRejectRegex = /\b(?:lot|sl|sr|s\.?no|no)\b[\s.:-]*$/i;
  while ((match = countUnitRegex.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val)) {
      const prefixText = text.substring(0, match.index);
      if (!prefixRejectRegex.test(prefixText)) {
        matches.push({
          value: val,
          unit: match[2].toUpperCase().trim(),
          index: match.index
        });
      } else {
        log.info(
          { matchedText: match[0], matchedVal: val, matchedIndex: match.index },
          "Rejected OCR quantity match because it is preceded by a serial/lot number indicator"
        );
      }
    }
  }

  if (matches.length === 0) {
    return { qty: '1', unit: 'Lot' };
  }

  // Deduplicate overlapping matches within 15 characters
  matches.sort((a, b) => a.index - b.index);
  const uniqueMatches: typeof matches = [];
  for (const m of matches) {
    const isOverlapping = uniqueMatches.some(
      (um) => Math.abs(um.index - m.index) < 15
    );
    if (!isOverlapping) {
      uniqueMatches.push(m);
    }
  }

  // Group and sum by standardized unit
  const groups: { [unit: string]: number } = {};
  for (const m of uniqueMatches) {
    let u = m.unit;
    if (u === 'KG') u = 'KGS';
    if (u === 'MT') u = 'MTS';
    if (u === 'PC') u = 'PCS';
    if (u === 'LTR') u = 'LTRS';
    if (u === 'TON') u = 'TONS';
    if (u === 'ITEM') u = 'ITEMS';
    
    groups[u] = (groups[u] || 0) + m.value;
  }

  const groupEntries = Object.entries(groups);
  if (groupEntries.length === 0) {
    return { qty: '1', unit: 'Lot' };
  }

  if (groupEntries.length === 1) {
    const [u, totalVal] = groupEntries[0];
    const qty = Number.isInteger(totalVal)
      ? totalVal.toLocaleString('en-IN')
      : totalVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    return { qty, unit: u };
  } else {
    const qty = groupEntries
      .map(([u, totalVal]) => {
        const formattedVal = Number.isInteger(totalVal)
          ? totalVal.toLocaleString('en-IN')
          : totalVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        return `${formattedVal} ${u}`;
      })
      .join(' + ');
    return { qty, unit: '' };
  }
}

async function extractAndProcessLotDocuments(
  catalogText: string,
  sanitizedAuctionNum: string,
  headers: Record<string, string>,
  items: any[] = [],
): Promise<{
  imageUrls: string[];
  attachmentMap: Record<string, string[]>;
  lotSpecificImagesMap: Record<string, string[]>;
  eligibilityNotes: string[];
}> {
  // Reconstruct filename if there are newlines or spaces
  const cleanedText = catalogText
    .replace(/\r?\n/g, " ")
    .replace(
      /(Annex_|Photo_)\s*([a-zA-Z0-9_]+)\s*([a-zA-Z0-9_]*)\s*(\.pdf)/gi,
      (_match, p1, p2, p3, p4) => {
        return `${p1}${p2}${p3 || ""}${p4}`;
      },
    );

  const matches = cleanedText.match(/([a-zA-Z0-9_]+\.pdf)/g) || [];
  const uniqueAttachments = Array.from(new Set(matches)).filter((name) => {
    const n = name.toLowerCase();
    return n.startsWith("photo_") || n.startsWith("annex_");
  });

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

  // Build reverse map: attachment filename → pre-assigned lot item(s) from catalog parsing.
  // This is more reliable than text-based matching for generic lot descriptions
  // (e.g. "General Non Electrical Items") where keywords won't appear in the PDF inventory.
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

  for (let i = 0; i < uniqueAttachments.length; i++) {
    const fileName = uniqueAttachments[i];
    const lotImageUrls: string[] = [];

    // Determine initial doc_type
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
      continue;
    }

    log.info(
      { fileName, sizeBytes: docBuffer.length },
      "Attachment retrieved, processing images",
    );

    // 1. Try to render all pages of the attachment and match them page-by-page
    const renderedPages = await renderAndExtractPdfPages(docBuffer, 20);
    if (renderedPages.length > 0) {
      log.info(
        { fileName, pageCount: renderedPages.length },
        "Rendered attachment pages, executing text matching with OCR",
      );

      const pageUrls: string[] = [];
      const pageToLots: any[][] = [];

      for (let pIdx = 0; pIdx < renderedPages.length; pIdx++) {
        const page = renderedPages[pIdx];
        try {
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_page_${page.pageNumber}.jpg`;
          const publicUrl = await uploadToStorage(
            imgPath,
            page.imageBuffer,
            "image/jpeg",
          );
          
          imageUrls.push(publicUrl);
          lotImageUrls.push(publicUrl);
          pageUrls.push(publicUrl);

          // Perform OCR to extract text from scans/photos on this page
          const ocrText = await performOcr(page.imageBuffer);
          const combinedText = `${page.text || ""}\n${ocrText}`;

          // Use pre-assigned lot mapping first (from catalog parsing), fall back to text-based matching
          let matched = attachmentToLots.get(fileName) || [];
          if (matched.length === 0) {
            matched = matchPageToLots(combinedText, items, fileName);
          }
          pageToLots.push(matched);

          if (matched.length > 0) {
            log.info(
              { pageNumber: page.pageNumber, matchedLots: matched.map(m => m.sr) },
              "Mapped rendered page specifically to lot(s)",
            );
            
            // Extract quantities from the combined text
            const extracted = extractQuantitiesDetailed(combinedText);

            // Classify page: skip parsing if it is a terms & conditions or instructional page
            const lowerText = combinedText.toLowerCase();
            const isTermsPage = 
              lowerText.includes("special terms") || 
              lowerText.includes("general terms") || 
              lowerText.includes("instructions to bidders") || 
              lowerText.includes("payment guidelines") || 
              lowerText.includes("how to participate") ||
              lowerText.includes("terms and conditions") ||
              lowerText.includes("terms & conditions") ||
              lowerText.includes("guide for making payment");

            const subItems = isTermsPage ? [] : parseSubItemsFromText(combinedText);
            if (subItems && subItems.length > 0) {
              log.info(
                { pageNumber: page.pageNumber, subItemsCount: subItems.length },
                `Extracted ${subItems.length} sub-items from page text`
              );
            }

            for (const lot of matched) {
              const srStr = String(lot.sr);
              if (!lotSpecificImagesMap[srStr]) {
                lotSpecificImagesMap[srStr] = [];
              }
              lotSpecificImagesMap[srStr].push(publicUrl);

              if (subItems && subItems.length > 0) {
                if (!lot.subItems) {
                  lot.subItems = [];
                }
                for (const sub of subItems) {
                  if (!lot.subItems.some((s: any) => s.sr === sub.sr && s.description === sub.description)) {
                    lot.subItems.push(sub);
                  }
                }
              }

              // Update lot quantity from OCR only when no sub-items were found on this page.
              // When sub-items exist, extractQuantitiesDetailed picks up individual item
              // quantities and produces garbage (e.g. "1 PLASTIC + 6 PCS + 170 NOS").
              // Instead, lot qty will be derived from sub-item count in the final pass below.
              if (!subItems || subItems.length === 0) {
                if (extracted && extracted.qty && extracted.qty !== "1" && extracted.qty !== "1.0") {
                  const currentQtyLower = (lot.qty || "").toLowerCase().trim();
                  const currentUnitLower = (lot.unit || "").toLowerCase().trim();
                  const isCurrentGeneric = 
                    currentQtyLower === "1" || 
                    currentQtyLower === "1.0" || 
                    currentUnitLower === "lot" || 
                    currentUnitLower === "lots";

                  if (isCurrentGeneric) {
                    log.info(
                      { lotSr: lot.sr, oldQty: lot.qty, oldUnit: lot.unit, newQty: extracted.qty, newUnit: extracted.unit },
                      "Updating lot quantity from OCR/scanned text"
                    );
                    lot.qty = extracted.qty;
                    lot.unit = extracted.unit;
                  }
                }
              }
            }
          }
        } catch (uploadErr: any) {
          log.warn(
            { errorMessage: uploadErr.message, pageNumber: page.pageNumber },
            "Failed to process rendered page image",
          );
        }
      }

      // Check if ANY specific matches were made for this attachment
      const hasSpecificMatches = pageToLots.some(m => m.length > 0);
      
      // Fallback 1: Sequential matching if pages count matches items count
      if (!hasSpecificMatches && renderedPages.length === items.length && items.length > 0) {
        log.info(
          { fileName, pageCount: renderedPages.length, itemsCount: items.length },
          "No specific page matches found, mapping pages sequentially to lots",
        );
        for (let pIdx = 0; pIdx < pageUrls.length; pIdx++) {
          const item = items[pIdx];
          const srStr = String(item.sr);
          if (!lotSpecificImagesMap[srStr]) {
            lotSpecificImagesMap[srStr] = [];
          }
          lotSpecificImagesMap[srStr].push(pageUrls[pIdx]);

          // Run OCR and extract quantities for sequential matching as well
          const page = renderedPages[pIdx];
          try {
            const ocrText = await performOcr(page.imageBuffer);
            const combinedText = `${page.text || ""}\n${ocrText}`;
            const extracted = extractQuantitiesDetailed(combinedText);
            
            // Classify page: skip parsing if it is a terms & conditions or instructional page
            const lowerText = combinedText.toLowerCase();
            const isTermsPage = 
              lowerText.includes("special terms") || 
              lowerText.includes("general terms") || 
              lowerText.includes("instructions to bidders") || 
              lowerText.includes("payment guidelines") || 
              lowerText.includes("how to participate") ||
              lowerText.includes("terms and conditions") ||
              lowerText.includes("terms & conditions") ||
              lowerText.includes("guide for making payment");

            const subItems = isTermsPage ? [] : parseSubItemsFromText(combinedText);
            if (subItems && subItems.length > 0) {
              if (!item.subItems) {
                item.subItems = [];
              }
              for (const sub of subItems) {
                if (!item.subItems.some((s: any) => s.sr === sub.sr && s.description === sub.description)) {
                  item.subItems.push(sub);
                }
              }
            }

            if (!subItems || subItems.length === 0) {
              if (extracted && extracted.qty && extracted.qty !== "1" && extracted.qty !== "1.0") {
                const currentQtyLower = (item.qty || "").toLowerCase().trim();
                const currentUnitLower = (item.unit || "").toLowerCase().trim();
                const isCurrentGeneric = 
                  currentQtyLower === "1" || 
                  currentQtyLower === "1.0" || 
                  currentUnitLower === "lot" || 
                  currentUnitLower === "lots";

                if (isCurrentGeneric) {
                  log.info(
                    { lotSr: item.sr, oldQty: item.qty, newQty: extracted.qty },
                    "Updating sequential lot quantity from OCR/scanned text"
                  );
                  item.qty = extracted.qty;
                  item.unit = extracted.unit;
                }
              }
            }
          } catch (ocrErr: any) {
            log.warn({ errorMessage: ocrErr.message }, "OCR failed during sequential fallback");
          }
        }
      }
    } else {
      // 2. Fallback to extracting embedded JPEGs if page rendering yielded nothing
      const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
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
            imageUrls.push(publicUrl);
            lotImageUrls.push(publicUrl);

            // Run OCR on the embedded image to match lots and extract quantities
            const ocrText = await performOcr(imgBuffer);
            if (ocrText) {
              // Use pre-assigned lot mapping first, fall back to text-based matching
              let matched = attachmentToLots.get(fileName) || [];
              if (matched.length === 0) {
                matched = matchPageToLots(ocrText, items, fileName);
              }
              if (matched.length > 0) {
                const extracted = extractQuantitiesDetailed(ocrText);
                for (const lot of matched) {
                  const srStr = String(lot.sr);
                  if (!lotSpecificImagesMap[srStr]) {
                    lotSpecificImagesMap[srStr] = [];
                  }
                  lotSpecificImagesMap[srStr].push(publicUrl);

                  // Classify page: skip parsing if it is a terms & conditions or instructional page
                  const lowerText = ocrText.toLowerCase();
                  const isTermsPage = 
                    lowerText.includes("special terms") || 
                    lowerText.includes("general terms") || 
                    lowerText.includes("instructions to bidders") || 
                    lowerText.includes("payment guidelines") || 
                    lowerText.includes("how to participate") ||
                    lowerText.includes("terms and conditions") ||
                    lowerText.includes("terms & conditions") ||
                    lowerText.includes("guide for making payment");

                  const subItems = isTermsPage ? [] : parseSubItemsFromText(ocrText);
                  if (subItems && subItems.length > 0) {
                    if (!lot.subItems) {
                      lot.subItems = [];
                    }
                    for (const sub of subItems) {
                      if (!lot.subItems.some((s: any) => s.sr === sub.sr && s.description === sub.description)) {
                        lot.subItems.push(sub);
                      }
                    }
                  }

                  // Only update qty from OCR when no sub-items were found
                  if (!subItems || subItems.length === 0) {
                    if (extracted && extracted.qty && extracted.qty !== "1" && extracted.qty !== "1.0") {
                      const currentQtyLower = (lot.qty || "").toLowerCase().trim();
                      const currentUnitLower = (lot.unit || "").toLowerCase().trim();
                      const isCurrentGeneric = 
                        currentQtyLower === "1" || 
                        currentQtyLower === "1.0" || 
                        currentUnitLower === "lot" || 
                        currentUnitLower === "lots";

                      if (isCurrentGeneric) {
                        log.info(
                          { lotSr: lot.sr, oldQty: lot.qty, newQty: extracted.qty },
                          "Updating fallback lot quantity from OCR/scanned text"
                        );
                        lot.qty = extracted.qty;
                        lot.unit = extracted.unit;
                      }
                    }
                  }
                }
              }
            }
          } catch (uploadErr: any) {
            log.warn(
              { errorMessage: uploadErr.message },
              "Failed to upload extracted attachment image",
            );
          }
        }
      }
    }

    attachmentMap[fileName] = lotImageUrls;
  }

  // Final pass: derive lot quantity from sub-items when the current qty is generic.
  // This is more reliable than extractQuantitiesDetailed which produces garbage
  // when scanning pages full of individual item rows.
  for (const item of items) {
    if (item.subItems && item.subItems.length > 0) {
      const currentQtyLower = (item.qty || "").toLowerCase().trim();
      const currentUnitLower = (item.unit || "").toLowerCase().trim();
      const isGenericOrGarbage =
        currentQtyLower === "1" ||
        currentQtyLower === "1.0" ||
        currentUnitLower === "lot" ||
        currentUnitLower === "lots" ||
        currentQtyLower.includes("+"); // e.g. "1 PLASTIC + 6 PCS + 170 NOS"

      if (isGenericOrGarbage) {
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
    eligibilityNotes: Array.from(new Set(eligibilityNotes)) 
  };
}

// ─── Queue Pipeline ──────────────────────────────────────────────────────────

/**
 * Read session cookies from disk (if available) for MSTC authentication.
 */
function loadSessionCookies(): string | null {
  try {
    if (fs.existsSync("cookies.txt")) {
      const cookieString = fs.readFileSync("cookies.txt", "utf-8");
      if (cookieString.trim()) {
        return cookieString.trim();
      }
    }
  } catch (cookieErr: any) {
    log.warn({ errorMessage: cookieErr.message }, "Failed to read cookies.txt");
  }
  return null;
}

/**
 * Build HTTP headers for MSTC requests, including session cookies when available.
 */
function buildMstcHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const cookies = loadSessionCookies();
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

  const url = new URL(record.source_pdf_url);
  const aucId = url.searchParams.get("auc") || "";

  const formData = new URLSearchParams();
  formData.append("auc", aucId);
  formData.append("cat", "0");
  formData.append("sell", "0");

  const headers = buildMstcHeaders();

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
        "PDF catalog fetch failed, retrying..."
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

  const fileBuffer = Buffer.from(await payloadResponse.arrayBuffer());

  // Validate PDF structure
  if (fileBuffer.toString("utf-8", 0, 4) !== "%PDF") {
    const preview = fileBuffer.toString("utf-8", 0, 1000);
    if (preview.includes("IBM_HTTP_Server") || preview.includes("Internal Server Error")) {
      throw new Error(
        "MSTC Server Error: IBM HTTP Server returned 500 (Internal Server Error) instead of a PDF catalog."
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

  const sanitizedAuctionNum = record.id;

  // Upload catalog PDF
  const catalogUrl = await uploadToStorage(
    `mstc-catalogs/${sanitizedAuctionNum}.pdf`,
    fileBuffer,
    "application/pdf",
  );

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
  try {
    jobLog.info({}, "Parsing PDF text content");
    const parsedPdf = await pdf(fileBuffer);
    if (parsedPdf?.text) {
      // First, parse the main catalog text to get structured items
      const summaryObj: CatalogSummary = parseMstcCatalogText(
        parsedPdf.text,
        record.category_name || "",
        record.seller_name || "",
        record.location || "",
      );

      // Initialize item.images as an empty array
      if (summaryObj.items && Array.isArray(summaryObj.items)) {
        for (const item of summaryObj.items) {
          item.images = [];
        }
      }

      // Render and match all pages of the main catalog PDF to individual lots
      try {
        jobLog.info({}, "Rendering all pages of main catalog PDF for page-specific matching");
        const catalogPages = await renderAndExtractPdfPages(fileBuffer, 20);
        if (catalogPages.length > 0) {
          jobLog.info(
            { pageCount: catalogPages.length },
            "Rendered main catalog pages, executing text matching",
          );

          for (const page of catalogPages) {
            try {
              let publicUrl = "";
              if (page.pageNumber === 1 && previewImageUrl) {
                publicUrl = previewImageUrl;
              } else {
                const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_catalog_page_${page.pageNumber}.jpg`;
                publicUrl = await uploadToStorage(
                  imgPath,
                  page.imageBuffer,
                  "image/jpeg",
                );
              }

              // Add to extractedImageUrls so it shows in general gallery
              if (!extractedImageUrls.includes(publicUrl)) {
                extractedImageUrls.push(publicUrl);
              }

              // Match page to lots using selectable text first
              let combinedText = page.text || "";
              let matched = matchPageToLots(combinedText, summaryObj.items || [], "catalog");

              // If no match and text is empty/short, try OCR
              if (matched.length === 0 && (!combinedText || combinedText.trim().length < 50)) {
                const ocrText = await performOcr(page.imageBuffer);
                combinedText = `${combinedText}\n${ocrText}`;
                matched = matchPageToLots(combinedText, summaryObj.items || [], "catalog");
              }

              if (matched.length > 0) {
                jobLog.info(
                  { pageNumber: page.pageNumber, matchedLots: matched.map(m => m.sr) },
                  "Mapped main catalog page specifically to lot(s)",
                );
                for (const lot of matched) {
                  if (!lot.images) {
                    lot.images = [];
                  }
                  if (!lot.images.includes(publicUrl)) {
                    lot.images.push(publicUrl);
                  }
                }
              }
            } catch (pageErr: any) {
              jobLog.warn(
                { pageNumber: page.pageNumber, errorMessage: pageErr.message },
                "Failed to process main catalog page image",
              );
            }
          }
        }
      } catch (catRenderErr: any) {
        jobLog.warn(
          { errorMessage: catRenderErr.message },
          "Failed to render main catalog pages",
        );
      }

      // Now extract attachment images and run OCR using the parsed items list
      let attachmentImageUrls: string[] = [];
      let attachmentMap: Record<string, string[]> = {};
      try {
        const result = await extractAndProcessLotDocuments(
          parsedPdf.text,
          sanitizedAuctionNum,
          headers,
          summaryObj.items || [],
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

      // Map lot-specific images from the attachment map to the lot item objects
      if (summaryObj.items && Array.isArray(summaryObj.items)) {
        for (const item of summaryObj.items) {
          if (!item.images) {
            item.images = [];
          }
          if (item.attachments && Array.isArray(item.attachments)) {
            const itemImages: string[] = [];
            for (const attName of item.attachments) {
              const urls = attachmentMap[attName];
              if (urls && urls.length > 0) {
                itemImages.push(...urls);
              }
            }
            // Add any newly found attachment images, checking for duplicates
            for (const imgUrl of itemImages) {
              if (!item.images.includes(imgUrl)) {
                item.images.push(imgUrl);
              }
            }
          }
        }
      }

      // Inject preview and extracted images into the summary
      summaryObj.preview_image_url = previewImageUrl;
      summaryObj.extracted_images = extractedImageUrls;

      // Calculate total market price valuation
      try {
        const totalMarketValue = calculateTotalMarketValue(summaryObj.items || [], record.category_name || "");
        summaryObj.totalMarketValue = totalMarketValue;
        jobLog.info({ totalMarketValue }, "Calculated total market value for catalog");
      } catch (valErr: any) {
        jobLog.warn({ errorMessage: valErr.message }, "Failed to calculate total market value");
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

  // Generate AI Semantic Embedding vector for Hybrid Search
  let embeddingStr: string | null = null;
  try {
    const textToEmbed = `${record.category_name || ''} ${rawMaterialsText || ''}`.trim();
    if (textToEmbed.length >= 5) {
      jobLog.info({}, "Generating AI embedding vector for semantic search");
      const extractor = await getEmbeddingPipeline();
      const output = await extractor(textToEmbed, {
        pooling: 'mean',
        normalize: true,
      });
      const vector = Array.from(output.data);
      embeddingStr = `[${vector.join(',')}]`;
    }
  } catch (embedErr: any) {
    jobLog.warn(
      { errorMessage: embedErr.message },
      "Failed to generate AI embedding vector, skipping vector integration for this item"
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

  if (embeddingStr) {
    updatePayload.embedding = embeddingStr;
  }

  await supabase
    .from("mstc_auctions")
    .update(updatePayload)
    .eq("id", record.id);

  // Log download event to audit logs
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
  const { data: executableQueue, error: queryError } = await supabase
    .from("mstc_auctions")
    .select(
      "id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text, updated_at",
    )
    .or("asset_status.eq.pending,asset_status.eq.failed")
    .lt("retry_count", MAX_RETRY_COUNT)
    .limit(100);

  if (queryError) {
    log.error(
      { errorMessage: queryError.message },
      "Queue query failed",
    );
    return;
  }

  if (!executableQueue || executableQueue.length === 0) {
    return;
  }

  // Filter queue items in JS to discard those within their backoff cooldown window
  const now = Date.now();
  const eligibleRecords = (executableQueue as QueueRecord[]).filter((record) => {
    if (record.retry_count === 0) {
      return true; // brand new job, process immediately
    }
    const lastUpdated = record.updated_at ? new Date(record.updated_at).getTime() : 0;
    const cooldown = getRetryDelayMs(record.retry_count);
    const timeSinceLastUpdate = now - lastUpdated;
    
    const isEligible = timeSinceLastUpdate >= cooldown;
    if (!isEligible) {
      log.debug(
        {
          auctionNumber: record.mstc_auction_number,
          retryCount: record.retry_count,
          cooldownMs: cooldown,
          timeRemainingMs: cooldown - timeSinceLastUpdate,
        },
        "Skipping record due to exponential backoff cooldown"
      );
    }
    return isEligible;
  });

  if (eligibleRecords.length === 0) {
    return;
  }

  const batchToProcess = eligibleRecords.slice(0, QUEUE_BATCH_SIZE);

  log.info(
    { batchSize: batchToProcess.length, totalEligible: eligibleRecords.length },
    "Processing queue batch",
  );

  for (const record of batchToProcess) {
    // Row-Lock: Set state to processing immediately, and update updated_at
    await supabase
      .from("mstc_auctions")
      .update({ asset_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", record.id);

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

      // Log failure event to audit logs
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
const isMain = process.argv[1] && (
  process.argv[1].endsWith('assetWorker.ts') || 
  process.argv[1].endsWith('assetWorker.js')
);

if (isMain) {
  startWorker();
}