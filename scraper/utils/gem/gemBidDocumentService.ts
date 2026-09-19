/**
 * GeM Authentic Bid Document Ingestion & Storage Service
 *
 * Downloads official government procurement bid documents from GeM BidPlus
 * (/showbidDocument/<id>), verifies binary integrity (%PDF magic bytes),
 * extracts structured text intelligence (untruncated items, department, ministry,
 * buyer email, quantities), and uploads them to Supabase Storage for persistent,
 * zero-latency CDN delivery.
 */
import type { Page } from "puppeteer";
import { createRequire } from "module";
import https from "https";
import { URL } from "url";
import { uploadToStorage, checkFileExistsInStorage } from "../common/storage.js";
import { logger } from "../common/logger.js";
import { STORAGE_BUCKET, DEFAULT_USER_AGENT } from "../../config.js";
import { parseGeMBidDate } from "../../parsers/gemBidParser.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const log = logger.child({ module: "gemBidDocumentService" });

export interface GemBidPdfMetadata {
  untruncatedItemName?: string;
  departmentName?: string;
  ministry?: string;
  organisation?: string;
  officeName?: string;
  buyerEmail?: string;
  quantity?: string;
  endDate?: string;
  openingDate?: string;
  extractedText: string;
}

export interface RealGemBidDocumentResult {
  publicUrl: string;
  metadata: GemBidPdfMetadata;
  sizeBytes: number;
  filename: string;
}

/**
 * Validates that a buffer starts with the `%PDF` (0x25 0x50 0x44 0x46) magic bytes.
 */
export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 32) return false;
  return buffer.subarray(0, 4).toString("utf-8") === "%PDF";
}

/**
 * Parses raw text extracted from a GeM Bid PDF into structured metadata.
 */
export function parseGemBidPdfText(rawText: string): GemBidPdfMetadata {
  const metadata: GemBidPdfMetadata = {
    extractedText: rawText,
  };

  if (!rawText) return metadata;

  // Clean lines for targeted extraction
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Item Category / Untruncated Items
  // Formats: "Item Category/मद केटेगरी Hot / Cold Water Dispenser (V2)" or "Item Category : Hot / Cold..."
  const itemMatch = rawText.match(/Item\s*Category[^\n:]*[:/]?\s*([^\n\r]+)/i);
  if (itemMatch && itemMatch[1]) {
    let rawItem = itemMatch[1].trim();
    // Strip trailing Hindi translations or parentheses if appropriate
    rawItem = rawItem.replace(/\s*\(Q\d+\)\s*$/i, "").trim();
    if (rawItem.length > 2) {
      metadata.untruncatedItemName = rawItem;
    }
  }

  // 2. Department Name
  const deptMatch = rawText.match(/Department\s*Name[^\n:]*[:/]?\s*([^\n\r]+)/i);
  if (deptMatch && deptMatch[1]) {
    metadata.departmentName = deptMatch[1].trim();
  }

  // 3. Ministry / State Name
  const minMatch = rawText.match(/Ministry(?:\/State)?\s*Name[^\n:]*[:/]?\s*([^\n\r]+)/i);
  if (minMatch && minMatch[1]) {
    metadata.ministry = minMatch[1].trim();
  }

  // 4. Organisation Name
  const orgMatch = rawText.match(/Organisation\s*Name[^\n:]*[:/]?\s*([^\n\r]+)/i);
  if (orgMatch && orgMatch[1]) {
    metadata.organisation = orgMatch[1].trim();
  }

  // 5. Office Name
  const offMatch = rawText.match(/Office\s*Name[^\n:]*[:/]?\s*([^\n\r]+)/i);
  if (offMatch && offMatch[1]) {
    metadata.officeName = offMatch[1].trim();
  }

  // 6. Total Quantity
  const qtyMatch = rawText.match(/Total\s*Quantity[^\n:]*[:/]?\s*([0-9.,]+)/i);
  if (qtyMatch && qtyMatch[1]) {
    metadata.quantity = qtyMatch[1].trim();
  }

  // 7. Buyer Email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const buyerEmailMatch = rawText.match(/Buyer\s*Email[^\n:]*[:/]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/i);
  if (buyerEmailMatch && buyerEmailMatch[1]) {
    metadata.buyerEmail = buyerEmailMatch[1].trim();
  } else {
    const allEmails = rawText.match(emailRegex);
    if (allEmails && allEmails.length > 0) {
      // Choose first valid government/buyer email, ignoring generic support/portal emails
      const genuineEmail = allEmails.find((e) => !e.includes("gem.gov.in") && !e.includes("support") && !e.includes("helpdesk")) || allEmails[0];
      if (genuineEmail) metadata.buyerEmail = genuineEmail;
    }
  }

  // 8. Bid End Date / Time
  const endMatch = rawText.match(/Bid\s*End\s*Date(?:\/Time)?[^\n:]*[:/]?\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/i);
  if (endMatch && endMatch[1]) {
    const parsedEnd = parseGeMBidDate(endMatch[1]);
    if (parsedEnd) metadata.endDate = parsedEnd;
  }

  return metadata;
}

/**
 * Downloads a GeM Bid PDF via active Puppeteer browser session.
 * This guarantees proper session cookies, TLS fingerprint, and Referer headers.
 */
export async function downloadBidPdfInSession(
  page: Page,
  documentUrl: string
): Promise<Buffer | null> {
  try {
    const absoluteUrl = documentUrl.startsWith("http")
      ? documentUrl
      : `https://bidplus.gem.gov.in/${documentUrl.replace(/^\/+/, "")}`;

    log.debug({ url: absoluteUrl }, "Downloading bid PDF in active browser session...");

    const base64Data = await page.evaluate(async (targetUrl: string) => {
      try {
        const res = await fetch(targetUrl, {
          credentials: "include",
          headers: {
            Accept: "application/pdf,application/octet-stream,*/*",
          },
        });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      } catch {
        return null;
      }
    }, absoluteUrl);

    if (!base64Data) {
      log.warn({ url: absoluteUrl }, "In-session fetch returned null data");
      return null;
    }

    const buffer = Buffer.from(base64Data, "base64");
    if (!isValidPdfBuffer(buffer)) {
      log.warn({ url: absoluteUrl, length: buffer.length }, "Downloaded buffer failed %PDF magic byte check");
      return null;
    }

    return buffer;
  } catch (err: any) {
    log.error({ url: documentUrl, error: err.message }, "Exception downloading bid PDF in session");
    return null;
  }
}

/**
 * Downloads a GeM Bid PDF directly via HTTPS with required Referer and User-Agent headers.
 * Useful as a lightweight alternative when full browser execution is bypassed or during on-demand proxy.
 */
export function downloadBidPdfDirectHttp(
  documentUrl: string,
  timeoutMs = 15000
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(documentUrl.startsWith("http") ? documentUrl : `https://bidplus.gem.gov.in/${documentUrl.replace(/^\/+/, "")}`);
      
      const isGem = parsed.hostname.includes("gem.gov.in");
      const req = https.get(
        parsed.toString(),
        {
          ...(isGem ? { family: 4 } : {}),
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
            Accept: "application/pdf,application/octet-stream,*/*",
            Referer: "https://bidplus.gem.gov.in/all-bids",
          },
        },
        (res) => {
          if (res.statusCode && (res.statusCode >= 300 && res.statusCode < 400) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, parsed.toString()).toString();
            downloadBidPdfDirectHttp(redirectUrl, timeoutMs).then(resolve);
            return;
          }

          if (res.statusCode !== 200) {
            log.warn({ statusCode: res.statusCode, url: documentUrl }, "Direct HTTP bid download returned non-200");
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            if (isValidPdfBuffer(buffer)) {
              resolve(buffer);
            } else {
              log.warn({ url: documentUrl, size: buffer.length }, "Direct HTTP response failed %PDF check");
              resolve(null);
            }
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        log.warn({ url: documentUrl }, "Direct HTTP download timed out");
        resolve(null);
      });

      req.on("error", (err) => {
        log.warn({ url: documentUrl, error: err.message }, "Direct HTTP download error");
        resolve(null);
      });
    } catch (err: any) {
      log.error({ error: err.message }, "Invalid URL in downloadBidPdfDirectHttp");
      resolve(null);
    }
  });
}

/**
 * High-level function to ingest, verify, parse, and upload a GeM Bid document to Supabase Storage.
 */
export async function processAndUploadGemBidDocument(
  bidNumber: string,
  rawDocumentUrl: string,
  page?: Page
): Promise<RealGemBidDocumentResult | null> {
  const sanitizedBidNo = bidNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `gem-bids/${sanitizedBidNo}/official_bid_document.pdf`;

  // 1. Check if document is already cached in Supabase Storage
  const { exists, publicUrl: existingUrl } = await checkFileExistsInStorage(storagePath);
  if (exists && existingUrl) {
    log.info({ bidNumber, storagePath }, "Document already exists in storage. Returning cached URL.");
    return {
      publicUrl: existingUrl,
      metadata: { extractedText: "" },
      sizeBytes: 0,
      filename: `GeM_Bid_${sanitizedBidNo}.pdf`,
    };
  }

  // 2. Download authentic PDF buffer
  let pdfBuffer: Buffer | null = null;
  if (page) {
    pdfBuffer = await downloadBidPdfInSession(page, rawDocumentUrl);
  }
  if (!pdfBuffer) {
    pdfBuffer = await downloadBidPdfDirectHttp(rawDocumentUrl);
  }

  if (!pdfBuffer) {
    log.warn({ bidNumber, rawDocumentUrl }, "Failed to acquire valid PDF buffer for bid");
    return null;
  }

  // 3. Extract text intelligence
  let metadata: GemBidPdfMetadata = { extractedText: "" };
  try {
    const parsedPdf = await pdfParse(pdfBuffer);
    metadata = parseGemBidPdfText(parsedPdf.text || "");
  } catch (parseErr: any) {
    log.warn({ bidNumber, error: parseErr.message }, "pdf-parse could not extract text; proceeding with upload");
  }

  // 4. Upload authentic PDF to Supabase Storage
  const publicUrl = await uploadToStorage(storagePath, pdfBuffer, "application/pdf");

  log.info(
    { bidNumber, sizeBytes: pdfBuffer.length, publicUrl, item: metadata.untruncatedItemName },
    "Successfully uploaded authentic GeM Bid document to Supabase Storage"
  );

  return {
    publicUrl,
    metadata,
    sizeBytes: pdfBuffer.length,
    filename: `GeM_Bid_${sanitizedBidNo}.pdf`,
  };
}
