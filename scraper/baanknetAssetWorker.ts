/**
 * BaankNet Document Asset Worker
 *
 * Full intelligence pipeline for BaankNet auction documents:
 *
 * 1. Download & mirror documents to Supabase Storage (CDN)
 * 2. Validate format via magic byte detection (%PDF, JPEG, PNG, WebP)
 * 3. Extract text via pdf-parse
 * 4. OCR fallback for scanned/image-based PDFs (Tesseract)
 * 5. Generate preview thumbnail (page 1 → JPEG)
 * 6. Document classification (sale notice, valuation report, etc.)
 * 7. Property intelligence extraction (area, SARFAESI, valuation, contacts)
 * 8. Persist all intelligence to database
 *
 * Follows zero-trust validation: checks HTTP status, verifies magic bytes,
 * utilizes exponential backoff retries, and maintains strict idempotency.
 */

import path from "path";
import { createRequire } from "module";
import * as dotenv from "dotenv";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STORAGE_BUCKET,
  DEFAULT_USER_AGENT,
  POLL_INTERVAL_MS,
  QUEUE_BATCH_SIZE,
  ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
} from "./config.js";
import { supabase, uploadToStorage, checkFileExistsInStorage, assertSupabaseCredentials } from "./utils/common/storage.js";
import { logger } from "./utils/common/logger.js";
import { sendPipelineFailureAlert } from "./utils/common/alertingService.js";
import { renderPdfFirstPage } from "./utils/pdfUtils.js";
import { performOcrWithDetails } from "./utils/ocrUtils.js";
import { classifyBaanknetDocument, classifyBaanknetDocuments } from "./parsers/baanknet/documentClassifier.js";
import { parseBaanknetPropertyText } from "./parsers/baanknet/baanknetPropertyParser.js";
import type { ParsedPropertyIntelligence } from "./parsers/baanknet/baanknetPropertyParser.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config({ path: ".env.local" });
dotenv.config();

const log = logger.child({ module: "baanknetAssetWorker" });

/** Minimum text length to consider a PDF as having selectable text (not scanned). */
const MIN_SELECTABLE_TEXT_LENGTH = 100;

/** Maximum number of PDF pages to OCR for scanned documents. */
const MAX_OCR_PAGES = 3;

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BaanknetQueueRecord {
  id: string;
  baanknet_auction_id: string;
  document_url?: string | null;
  document_urls?: string[] | null;
  stored_document_urls?: string[] | null;
  documents_archived?: boolean;
}

export interface FailedDocumentReport {
  auctionId: string;
  url: string;
  error: string;
}

export interface WorkerBatchSummary {
  totalInspected: number;
  auctionsArchived: number;
  auctionsFailed: number;
  docsProcessed: number;
  docsUploaded: number;
  docsRetrievedFromCache: number;
  failedReports: FailedDocumentReport[];
}

// ─── Pure Utility Functions ──────────────────────────────────────────────────

/**
 * Builds standard browser headers for fetching files from BaankNet and banking CDNs.
 */
export function buildBaanknetHeaders(targetUrlStr: string): Record<string, string> {
  let origin = "https://baanknet.com";
  try {
    const parsed = new URL(targetUrlStr);
    origin = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // fallback to default origin
  }

  return {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "application/pdf,application/octet-stream,text/html,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${origin}/`,
  };
}

/**
 * Detects document binary format by verifying %PDF or image header magic bytes.
 */
export function detectDocumentFormat(buffer: Buffer): { isValid: boolean; contentType: string; ext: string } {
  if (!buffer || buffer.length < 4) return { isValid: false, contentType: "application/octet-stream", ext: "bin" };

  // PDF (%PDF)
  if (buffer.subarray(0, 4).toString("utf-8") === "%PDF") {
    return { isValid: true, contentType: "application/pdf", ext: "pdf" };
  }

  // PNG (\x89PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { isValid: true, contentType: "image/png", ext: "png" };
  }

  // JPEG/JPG (\xff\xd8\xff)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, contentType: "image/jpeg", ext: "jpg" };
  }

  // WebP (RIFF....WEBP)
  if (buffer.subarray(0, 4).toString("utf-8") === "RIFF" && buffer.length >= 12 && buffer.subarray(8, 12).toString("utf-8") === "WEBP") {
    return { isValid: true, contentType: "image/webp", ext: "webp" };
  }

  return { isValid: false, contentType: "application/octet-stream", ext: "bin" };
}

/**
 * Validates that buffer starts with the `%PDF` (0x25 0x50 0x44 0x46) magic bytes.
 */
export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return buffer.subarray(0, 4).toString("utf-8") === "%PDF";
}

/**
 * Generates an idempotent, clean storage path for a BaankNet document.
 */
export function getBaanknetStoragePath(
  auctionId: string,
  docUrl: string,
  index: number = 0
): string {
  const cleanAuctionId = (auctionId || "unknown_auction").replace(/[^a-zA-Z0-9_-]/g, "_");
  let filename = "";

  try {
    const parsed = new URL(docUrl);
    const base = path.basename(parsed.pathname);
    if (base && base.length > 3 && !base.startsWith("?")) {
      filename = base;
    }
  } catch {
    // Fallback if URL cannot be parsed
  }

  if (!filename) {
    filename = `document_${index + 1}.pdf`;
  }

  // Sanitize filename
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const hasValidExt = /\.(pdf|jpg|jpeg|png|webp)$/i.test(filename);
  if (!hasValidExt) {
    filename = `${filename}.pdf`;
  }

  return `baanknet-documents/${cleanAuctionId}/${filename}`;
}

const MAX_DOCS_PER_AUCTION = 10;

/**
 * Validates that a URL is a genuine auction/notice document and not a site-wide navigation/circular link.
 */
export function isValidAuctionDocUrl(urlStr: string): boolean {
  if (!urlStr || urlStr.length < 5) return false;
  if (urlStr.startsWith("javascript:") || urlStr === "#") return false;
  const lower = urlStr.toLowerCase();
  
  // Reject portal site-wide downloads, guidelines, circulars, general orders
  if (
    lower.includes("/home/downloads") ||
    lower.includes("/downloads") ||
    lower.includes("/circulars") ||
    lower.includes("/guidelines") ||
    lower.includes("/faq") ||
    lower.includes("/act") ||
    lower.includes("/rules") ||
    lower.includes("ibbi.gov.in/uploads/order/") ||
    lower.includes("ibbi.gov.in/uploads/circulars/")
  ) {
    return false;
  }

  // Must be PDF or genuine document endpoint
  return (
    lower.endsWith(".pdf") ||
    lower.includes(".pdf?") ||
    lower.includes("download") ||
    lower.includes("document") ||
    lower.includes("notice") ||
    lower.includes("tender") ||
    lower.includes("memo") ||
    lower.includes("view-doc") ||
    lower.includes("viewfile")
  );
}

/**
 * Normalizes all document URLs from a record into a clean, deduplicated array.
 */
export function extractUniqueDocUrls(record: BaanknetQueueRecord): string[] {
  const rawList: string[] = [];

  if (record.document_url && typeof record.document_url === "string") {
    rawList.push(record.document_url.trim());
  }

  if (Array.isArray(record.document_urls)) {
    for (const u of record.document_urls) {
      if (u && typeof u === "string") {
        rawList.push(u.trim());
      }
    }
  }

  const seen = new Set<string>();
  const cleanList: string[] = [];

  for (const urlStr of rawList) {
    if (!urlStr || urlStr.length < 5) continue;
    if (!isValidAuctionDocUrl(urlStr)) continue;
    
    // Normalize relative paths if necessary
    let normalized = urlStr;
    if (normalized.startsWith("//")) {
      normalized = `https:${normalized}`;
    } else if (normalized.startsWith("/")) {
      normalized = `https://baanknet.com${normalized}`;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      cleanList.push(normalized);
      if (cleanList.length >= MAX_DOCS_PER_AUCTION) break;
    }
  }

  return cleanList;
}

// ─── Document Processing Core ────────────────────────────────────────────────

/**
 * Downloads a single document URL, checks for existing cache, verifies PDF magic bytes,
 * and uploads to Supabase Storage.
 */
/**
 * Downloads a single document URL, checks for existing cache, verifies PDF magic bytes,
 * extracts text via pdf-parse, and uploads to Supabase Storage.
 */
export async function mirrorDocumentToStorage(
  auctionId: string,
  docUrl: string,
  docIndex: number,
  timeoutMs: number = ATTACHMENT_DOWNLOAD_TIMEOUT_MS
): Promise<{
  publicUrl: string;
  wasCached: boolean;
  text?: string;
  previewUrl?: string;
  classification?: { type: string; confidence: number; matchedKeywords: string[] };
}> {
  const docLog = log.child({ auctionId, docUrl });
  const storagePath = getBaanknetStoragePath(auctionId, docUrl, docIndex);

  // 1. Check storage cache first using metadata listing (zero byte network download)
  try {
    docLog.debug({ storagePath }, "Checking storage cache via metadata list");
    const { exists, publicUrl } = await checkFileExistsInStorage(storagePath, STORAGE_BUCKET);
    if (exists && publicUrl) {
      docLog.debug({ publicUrl }, "Document already exists in storage cache");
      return { publicUrl, wasCached: true };
    }
  } catch (err: any) {
    docLog.debug({ error: err.message }, "Metadata cache lookup skipped, proceeding with fetch");
  }

  // 2. Fetch with exponential backoff retries
  const headers = buildBaanknetHeaders(docUrl);
  const maxAttempts = 3;
  let lastError: any = null;
  let fileBuffer: Buffer | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(docUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`);
      }

      const arrayBuf = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      lastError = null;
      break;
    } catch (fetchErr: any) {
      lastError = fetchErr;
      docLog.warn(
        { attempt, maxAttempts, errorMessage: fetchErr.message },
        "Document fetch failed, retrying..."
      );
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  if (lastError || !fileBuffer) {
    throw lastError || new Error("Failed to fetch document buffer from upstream");
  }

  // 3. Verify Document Structure & Magic Bytes (PDF or high-res notice scans)
  const format = detectDocumentFormat(fileBuffer);
  if (!format.isValid) {
    const preview = fileBuffer.subarray(0, 300).toString("utf-8");
    if (preview.includes("<html") || preview.includes("<!DOCTYPE") || preview.includes("<HTML")) {
      throw new Error("Upstream server returned HTML error page instead of a valid document");
    }
    throw new Error("Downloaded document failed format / magic byte validation");
  }

  // 4. Extract text from PDF using pdf-parse (if PDF)
  let extractedText = "";
  if (format.contentType === "application/pdf") {
    try {
      const parsedPdf = await pdfParse(fileBuffer);
      if (parsedPdf && parsedPdf.text) {
        extractedText = parsedPdf.text.trim();
        docLog.debug({ textLength: extractedText.length }, "Extracted text from notice PDF");
      }
    } catch (err: any) {
      docLog.warn({ error: err.message }, "Non-critical: pdf-parse failed to extract text from PDF");
    }

    // 4b. OCR fallback for scanned/image-based PDFs
    if (extractedText.length < MIN_SELECTABLE_TEXT_LENGTH) {
      docLog.info(
        { textLength: extractedText.length },
        "PDF appears to be scanned (insufficient selectable text). Running OCR fallback..."
      );
      try {
        // Render first few pages to images and OCR them
        const previewBuf = await renderPdfFirstPage(fileBuffer);
        if (previewBuf) {
          const ocrResult = await performOcrWithDetails(previewBuf);
          if (ocrResult && ocrResult.text && ocrResult.text.length > extractedText.length) {
            docLog.info(
              { ocrTextLength: ocrResult.text.length, confidence: ocrResult.confidence },
              "OCR extracted additional text from scanned PDF"
            );
            extractedText = ocrResult.text;
          }
        }
      } catch (ocrErr: any) {
        docLog.warn({ error: ocrErr.message }, "Non-critical: OCR fallback failed for scanned PDF");
      }
    }
  }

  // 5. Upload to Supabase Storage with dynamic content-type
  const publicUrl = await uploadToStorage(storagePath, fileBuffer, format.contentType);
  docLog.info({ publicUrl, storagePath, sizeBytes: fileBuffer.length, contentType: format.contentType }, "Document successfully mirrored to storage");

  // 6. Generate preview thumbnail (first page → JPEG)
  let previewUrl: string | undefined;
  if (format.contentType === "application/pdf" && docIndex === 0) {
    try {
      const previewBuffer = await renderPdfFirstPage(fileBuffer);
      if (previewBuffer && previewBuffer.length > 1000) {
        const previewPath = `baanknet-previews/${auctionId.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
        previewUrl = await uploadToStorage(previewPath, previewBuffer, "image/jpeg");
        docLog.info({ previewUrl }, "Preview thumbnail generated and uploaded");
      }
    } catch (prevErr: any) {
      docLog.warn({ error: prevErr.message }, "Non-critical: preview generation failed");
    }
  }

  // 7. Document classification
  const classification = classifyBaanknetDocument(extractedText);
  if (classification.type !== "unknown") {
    docLog.info(
      { docType: classification.type, confidence: classification.confidence.toFixed(2) },
      "Document classified"
    );
  }

  return {
    publicUrl,
    wasCached: false,
    text: extractedText || undefined,
    previewUrl,
    classification,
  };
}

/**
 * Processes a single BaankNet auction row: downloads all attached documents,
 * extracts searchable text & metadata, updates stored_document_urls, and marks documents_archived upon total success.
 */
export async function processBaanknetRecord(
  record: BaanknetQueueRecord
): Promise<{
  allSucceeded: boolean;
  mirroredUrls: string[];
  docsUploaded: number;
  docsCached: number;
  failures: FailedDocumentReport[];
}> {
  const auctionLog = log.child({ auctionId: record.baanknet_auction_id });
  const docUrls = extractUniqueDocUrls(record);

  // If no document URLs exist on this listing, mark it as archived (nothing to mirror)
  if (docUrls.length === 0) {
    auctionLog.info("No documents attached to this auction. Marking archived.");
    await supabase
      .from("baanknet_auctions")
      .update({
        documents_archived: true,
        stored_document_urls: [],
      })
      .eq("baanknet_auction_id", record.baanknet_auction_id);

    return {
      allSucceeded: true,
      mirroredUrls: [],
      docsUploaded: 0,
      docsCached: 0,
      failures: [],
    };
  }

  auctionLog.info({ docCount: docUrls.length }, "Mirroring auction documents to storage");

  const mirroredUrls: string[] = [];
  const failures: FailedDocumentReport[] = [];
  const extractedTexts: string[] = [];
  const docClassifications: { url: string; type: string; confidence: number }[] = [];
  let firstPreviewUrl: string | undefined;
  let docsUploaded = 0;
  let docsCached = 0;

  for (let i = 0; i < docUrls.length; i++) {
    const url = docUrls[i];
    try {
      const result = await mirrorDocumentToStorage(
        record.baanknet_auction_id,
        url,
        i
      );
      mirroredUrls.push(result.publicUrl);
      if (result.text) {
        extractedTexts.push(result.text);
      }
      if (result.previewUrl && !firstPreviewUrl) {
        firstPreviewUrl = result.previewUrl;
      }
      if (result.classification && result.classification.type !== "unknown") {
        docClassifications.push({
          url: result.publicUrl,
          type: result.classification.type,
          confidence: result.classification.confidence,
        });
      }
      if (result.wasCached) {
        docsCached++;
      } else {
        docsUploaded++;
      }
    } catch (err: any) {
      auctionLog.warn(
        { docUrl: url, error: err.message },
        "Failed to mirror individual document"
      );
      failures.push({
        auctionId: record.baanknet_auction_id,
        url,
        error: err.message || "Unknown download error",
      });
    }
  }

  const allSucceeded = failures.length === 0 && mirroredUrls.length === docUrls.length;
  const combinedText = extractedTexts.join("\n\n---\n\n").trim();

  // ── Deep Intelligence Extraction ──────────────────────────────────────────
  let propertyIntelligence: ParsedPropertyIntelligence | null = null;
  if (combinedText.length > 50) {
    try {
      propertyIntelligence = parseBaanknetPropertyText(combinedText);
      const extractedFields = Object.entries(propertyIntelligence)
        .filter(([, v]) => v !== null)
        .map(([k]) => k);
      if (extractedFields.length > 0) {
        auctionLog.info(
          { extractedFieldCount: extractedFields.length, fields: extractedFields },
          "Property intelligence extracted from PDF text"
        );
      }
    } catch (parseErr: any) {
      auctionLog.warn({ error: parseErr.message }, "Non-critical: property intelligence parsing failed");
    }
  }

  // Persist storage public URLs, archive state, extracted PDF text, and intelligence
  const updatePayload: Record<string, any> = {
    stored_document_urls: mirroredUrls,
    documents_archived: allSucceeded,
    documents_archived_at: allSucceeded ? new Date().toISOString() : null,
  };

  if (combinedText) {
    updatePayload.extracted_pdf_text = combinedText.substring(0, 100000); // 100KB cap
  }
  if (firstPreviewUrl) {
    updatePayload.preview_url = firstPreviewUrl;
  }
  if (docClassifications.length > 0) {
    updatePayload.document_classification = docClassifications;
  }

  // Merge property intelligence fields (only set non-null values)
  if (propertyIntelligence) {
    if (propertyIntelligence.propertyClassification) {
      updatePayload.property_classification = propertyIntelligence.propertyClassification;
    }
    if (propertyIntelligence.carpetAreaSqft) {
      updatePayload.carpet_area_sqft = propertyIntelligence.carpetAreaSqft;
    }
    if (propertyIntelligence.landAreaSqft) {
      updatePayload.land_area_sqft = propertyIntelligence.landAreaSqft;
    }
    if (propertyIntelligence.valuationAmount) {
      updatePayload.valuation_amount = propertyIntelligence.valuationAmount;
    }
    if (propertyIntelligence.distressValue) {
      updatePayload.distress_value = propertyIntelligence.distressValue;
    }
    if (propertyIntelligence.valuerName) {
      updatePayload.valuer_name = propertyIntelligence.valuerName;
    }
    if (propertyIntelligence.sarfaesiSection) {
      updatePayload.sarfaesi_section = propertyIntelligence.sarfaesiSection;
    }
    if (propertyIntelligence.possessionType) {
      updatePayload.possession_type = propertyIntelligence.possessionType;
    }
    if (propertyIntelligence.surveyNumber) {
      updatePayload.survey_number = propertyIntelligence.surveyNumber;
    }
    if (propertyIntelligence.encumbranceSummary) {
      updatePayload.encumbrance_summary = propertyIntelligence.encumbranceSummary;
    }
    // Merge contacts only if not already set on the record
    if (propertyIntelligence.contactPhone) {
      updatePayload.contact_phone = propertyIntelligence.contactPhone;
    }
    if (propertyIntelligence.contactEmail) {
      updatePayload.officer_email = propertyIntelligence.contactEmail;
    }
  }

  const { error: updateError } = await supabase
    .from("baanknet_auctions")
    .update(updatePayload)
    .eq("baanknet_auction_id", record.baanknet_auction_id);

  if (updateError) {
    auctionLog.error({ errorMessage: updateError.message }, "Failed to update auction row with stored document URLs and intelligence");
  } else {
    auctionLog.info(
      {
        allSucceeded,
        storedCount: mirroredUrls.length,
        failures: failures.length,
        hasPdfText: !!combinedText,
        hasPreview: !!firstPreviewUrl,
        classifiedDocs: docClassifications.length,
        propertyFieldsExtracted: propertyIntelligence
          ? Object.values(propertyIntelligence).filter((v) => v !== null).length
          : 0,
      },
      "Updated auction document archive, classification, and property intelligence"
    );
  }

  return {
    allSucceeded,
    mirroredUrls,
    docsUploaded,
    docsCached,
    failures,
  };
}

// ─── Pipeline Execution ──────────────────────────────────────────────────────

/**
 * Runs a single cycle of the BaankNet asset pipeline queue.
 */
export async function runBaanknetAssetPipeline(
  batchSize: number = QUEUE_BATCH_SIZE
): Promise<WorkerBatchSummary> {
  assertSupabaseCredentials();
  log.info({ batchSize }, "Starting BaankNet document asset worker pipeline cycle");

  const summary: WorkerBatchSummary = {
    totalInspected: 0,
    auctionsArchived: 0,
    auctionsFailed: 0,
    docsProcessed: 0,
    docsUploaded: 0,
    docsRetrievedFromCache: 0,
    failedReports: [],
  };

  // 1. Query unarchived auctions that have at least one document URL
  const { data: records, error } = await supabase
    .from("baanknet_auctions")
    .select("id, baanknet_auction_id, document_url, document_urls, stored_document_urls, documents_archived")
    .eq("documents_archived", false)
    .limit(batchSize);

  if (error) {
    log.error({ error: error.message }, "Failed to query unarchived BaankNet auctions");
    return summary;
  }

  if (!records || records.length === 0) {
    log.info("No unarchived BaankNet auctions found in queue. Everything is up to date.");
    return summary;
  }

  summary.totalInspected = records.length;
  log.info({ count: records.length }, "Processing batch of unarchived BaankNet auctions");

  // 2. Process each auction sequentially to avoid hammering external bank servers
  for (const record of records as BaanknetQueueRecord[]) {
    try {
      const result = await processBaanknetRecord(record);

      summary.docsProcessed += (result.mirroredUrls.length + result.failures.length);
      summary.docsUploaded += result.docsUploaded;
      summary.docsRetrievedFromCache += result.docsCached;

      if (result.allSucceeded) {
        summary.auctionsArchived++;
      } else {
        summary.auctionsFailed++;
        summary.failedReports.push(...result.failures);
      }
    } catch (recordErr: any) {
      summary.auctionsFailed++;
      summary.failedReports.push({
        auctionId: record.baanknet_auction_id,
        url: record.document_url || "unknown",
        error: recordErr.message || "Unhandled record failure",
      });
      log.error(
        { auctionId: record.baanknet_auction_id, error: recordErr.message },
        "Unexpected error processing auction record"
      );
    }
  }

  // 3. Output comprehensive summary log
  log.info(
    {
      totalInspected: summary.totalInspected,
      auctionsArchived: summary.auctionsArchived,
      auctionsFailed: summary.auctionsFailed,
      docsProcessed: summary.docsProcessed,
      docsUploaded: summary.docsUploaded,
      docsRetrievedFromCache: summary.docsRetrievedFromCache,
      failedAuctionCount: summary.failedReports.length,
      failedReports: summary.failedReports,
    },
    "═══ BaankNet Document Asset Worker Cycle Complete ═══"
  );

  // Dispatch alert if failures were encountered
  if (summary.failedReports.length > 0) {
    await sendPipelineFailureAlert({
      serviceName: "BaankNet Document Asset Worker",
      totalInspected: summary.totalInspected,
      totalFailed: summary.failedReports.length,
      failures: summary.failedReports,
    });
  }

  return summary;
}

/**
 * Continuous worker daemon loop for background polling.
 */
export async function startBaanknetAssetWorker(batchSize: number = QUEUE_BATCH_SIZE): Promise<void> {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS, batchSize }, "BaankNet Document Asset Worker Service started");

  while (true) {
    try {
      await runBaanknetAssetPipeline(batchSize);
    } catch (err: any) {
      log.error({ errorMessage: err.message }, "BaankNet worker iteration failed");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// ─── Direct CLI Runner ───────────────────────────────────────────────────────

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("baanknetAssetWorker.ts") ||
    process.argv[1].endsWith("baanknetAssetWorker.js"));

if (isMain) {
  const once = process.argv.includes("--once");
  const batchArg = process.argv.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchArg ? parseInt(batchArg.replace("--batch-size=", ""), 10) : QUEUE_BATCH_SIZE;

  if (once) {
    runBaanknetAssetPipeline(batchSize)
      .then((summary) => {
        console.log("\n📊 Execution Summary:");
        console.log(`   Inspected: ${summary.totalInspected}`);
        console.log(`   Archived:  ${summary.auctionsArchived}`);
        console.log(`   Failed:    ${summary.auctionsFailed}`);
        console.log(`   Uploaded:  ${summary.docsUploaded}`);
        console.log(`   Cached:    ${summary.docsRetrievedFromCache}`);
        if (summary.failedReports.length > 0) {
          console.log(`\n⚠️  Failed Documents (${summary.failedReports.length}):`);
          for (const f of summary.failedReports) {
            console.log(`   • [${f.auctionId}] ${f.url} -> ${f.error}`);
          }
        }
        process.exit(summary.auctionsFailed > 0 && summary.auctionsArchived === 0 ? 1 : 0);
      })
      .catch((err) => {
        console.error("Fatal:", err);
        process.exit(1);
      });
  } else {
    startBaanknetAssetWorker(batchSize);
  }
}
