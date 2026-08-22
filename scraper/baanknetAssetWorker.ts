/**
 * BaankNet Document Asset Worker
 * 
 * Fetches and mirrors external bank auction notice PDFs from baanknet.com / CDN
 * to Supabase Storage (`baanknet-documents/{baanknet_auction_id}/`), making document access
 * permanent, lightning fast, and immune to upstream server link rot.
 * 
 * Follows zero-trust validation: checks HTTP status, verifies %PDF magic bytes,
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

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config({ path: ".env.local" });
dotenv.config();

const log = logger.child({ module: "baanknetAssetWorker" });

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
  if (!filename.toLowerCase().endsWith(".pdf")) {
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
): Promise<{ publicUrl: string; wasCached: boolean; text?: string }> {
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

  // 3. Verify PDF Structure & Magic Bytes
  if (!isValidPdfBuffer(fileBuffer)) {
    const preview = fileBuffer.subarray(0, 300).toString("utf-8");
    if (preview.includes("<html") || preview.includes("<!DOCTYPE") || preview.includes("<HTML")) {
      throw new Error("Upstream server returned HTML error page instead of a valid PDF document");
    }
    throw new Error("Downloaded document failed %PDF magic byte validation");
  }

  // 4. Extract text from PDF using pdf-parse
  let extractedText = "";
  try {
    const parsedPdf = await pdfParse(fileBuffer);
    if (parsedPdf && parsedPdf.text) {
      extractedText = parsedPdf.text.trim();
      docLog.debug({ textLength: extractedText.length }, "Extracted text from notice PDF");
    }
  } catch (err: any) {
    docLog.warn({ error: err.message }, "Non-critical: pdf-parse failed to extract text from PDF");
  }

  // 5. Upload to Supabase Storage
  const publicUrl = await uploadToStorage(storagePath, fileBuffer, "application/pdf");
  docLog.info({ publicUrl, storagePath, sizeBytes: fileBuffer.length }, "Document successfully mirrored to storage");

  return { publicUrl, wasCached: false, text: extractedText || undefined };
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

  // Persist storage public URLs, archive state, and extracted PDF text
  const updatePayload: Record<string, any> = {
    stored_document_urls: mirroredUrls,
    documents_archived: allSucceeded,
  };

  if (combinedText) {
    updatePayload.extracted_pdf_text = combinedText.substring(0, 100000); // 100KB cap for database row
  }

  const { error: updateError } = await supabase
    .from("baanknet_auctions")
    .update(updatePayload)
    .eq("baanknet_auction_id", record.baanknet_auction_id);

  if (updateError) {
    auctionLog.error({ errorMessage: updateError.message }, "Failed to update auction row with stored document URLs and PDF text");
  } else {
    auctionLog.info(
      { allSucceeded, storedCount: mirroredUrls.length, failures: failures.length, hasPdfText: !!combinedText },
      "Updated auction document archive and PDF intelligence status"
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

  return summary;
}

/**
 * Continuous worker daemon loop for background polling.
 */
export async function startBaanknetAssetWorker(): Promise<void> {
  log.info({ pollIntervalMs: POLL_INTERVAL_MS }, "BaankNet Document Asset Worker Service started");

  while (true) {
    try {
      await runBaanknetAssetPipeline();
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
  if (once) {
    runBaanknetAssetPipeline()
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
    startBaanknetAssetWorker();
  }
}
