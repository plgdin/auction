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
import { renderPdfFirstPage, extractEmbeddedJpegs } from "./utils/pdfUtils.js";
import { parseMstcCatalogText } from "./parsers/mstcParser.js";
import type { CatalogSummary } from "./parsers/mstcParser.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const log = logger.child({ module: "assetWorker" });

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueRecord {
  id: string;
  mstc_auction_number: string;
  source_pdf_url: string;
  retry_count: number;
  category_name: string | null;
  seller_name: string | null;
  location: string | null;
  raw_materials_text: string | null;
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

    if (!response.ok) {
      jobLog.warn(
        { status: response.status },
        "Attachment download returned non-OK status",
      );
      return null;
    }

    const docBuffer = await response.buffer();
    if (docBuffer.toString("utf-8", 0, 4) === "%PDF") {
      return docBuffer;
    }
  } catch (e: any) {
    jobLog.warn({ errorMessage: e.message }, "Network error downloading attachment");
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

/**
 * Extract attachment file references from the parsed catalog text,
 * download each, extract/render images, and upload them to storage.
 */
async function extractAndProcessLotDocuments(
  catalogText: string,
  sanitizedAuctionNum: string,
  headers: Record<string, string>,
): Promise<string[]> {
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

  if (uniqueAttachments.length === 0) {
    return [];
  }

  log.info(
    { count: uniqueAttachments.length, auctionNumber: sanitizedAuctionNum },
    "Found lot attachments to process",
  );

  const imageUrls: string[] = [];

  for (let i = 0; i < uniqueAttachments.length; i++) {
    const fileName = uniqueAttachments[i];

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

    // 1. Try to extract embedded JPEGs first (high-res original)
    const embeddedJpegs = extractEmbeddedJpegs(docBuffer);
    if (embeddedJpegs.length > 0) {
      log.info(
        { fileName, imageCount: embeddedJpegs.length },
        "Extracted embedded images from attachment",
      );
      for (let j = 0; j < embeddedJpegs.length; j++) {
        try {
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_img_${j}.jpg`;
          const publicUrl = await uploadToStorage(
            imgPath,
            embeddedJpegs[j],
            "image/jpeg",
          );
          imageUrls.push(publicUrl);
        } catch (uploadErr: any) {
          log.warn(
            { errorMessage: uploadErr.message },
            "Failed to upload extracted attachment image",
          );
        }
      }
    } else {
      // 2. If no embedded JPEGs, render the first page of the PDF to image
      log.info(
        { fileName },
        "No embedded JPEGs, rendering attachment page to image",
      );
      const renderBuffer = await renderPdfFirstPage(docBuffer);
      if (renderBuffer) {
        try {
          const imgPath = `mstc-extracted-images/${sanitizedAuctionNum}_lot_doc_${i}_page.jpg`;
          const publicUrl = await uploadToStorage(
            imgPath,
            renderBuffer,
            "image/jpeg",
          );
          imageUrls.push(publicUrl);
        } catch (uploadErr: any) {
          log.warn(
            { errorMessage: uploadErr.message },
            "Failed to upload rendered attachment image",
          );
        }
      }
    }
  }

  return imageUrls;
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
async function processRecord(record: QueueRecord): Promise<void> {
  const jobLog = log.child({ auctionNumber: record.mstc_auction_number });

  jobLog.info({}, "Starting document processing");

  const url = new URL(record.source_pdf_url);
  const aucId = url.searchParams.get("auc") || "";

  const formData = new URLSearchParams();
  formData.append("auc", aucId);
  formData.append("cat", "0");
  formData.append("sell", "0");

  const headers = buildMstcHeaders();

  const payloadResponse = await fetch(MSTC_CATALOG_PDF_ENDPOINT, {
    method: "POST",
    body: formData,
    headers,
    timeout: CATALOG_DOWNLOAD_TIMEOUT_MS,
  } as any);

  if (!payloadResponse.ok) {
    throw new Error(
      `Catalog download failed with status ${payloadResponse.status}`,
    );
  }

  const fileBuffer = await payloadResponse.buffer();

  // Validate PDF structure
  if (fileBuffer.toString("utf-8", 0, 4) !== "%PDF") {
    const preview = fileBuffer.toString("utf-8", 0, 200);
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

  const sanitizedAuctionNum = record.mstc_auction_number.replace(
    /[\/\\:*?"<>|]/g,
    "_",
  );

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
      // Extract attachment images from the parsed PDF text
      try {
        const attachmentImageUrls = await extractAndProcessLotDocuments(
          parsedPdf.text,
          sanitizedAuctionNum,
          headers,
        );
        if (attachmentImageUrls.length > 0) {
          extractedImageUrls.push(...attachmentImageUrls);
          jobLog.info(
            { attachmentImageCount: attachmentImageUrls.length },
            "Extracted and uploaded lot attachment images",
          );
        }
      } catch (attErr: any) {
        jobLog.warn(
          { errorMessage: attErr.message },
          "Failed to process lot attachments",
        );
      }

      const summaryObj: CatalogSummary = parseMstcCatalogText(
        parsedPdf.text,
        record.category_name || "",
        record.seller_name || "",
        record.location || "",
      );

      // Inject preview and extracted images into the summary
      summaryObj.preview_image_url = previewImageUrl;
      summaryObj.extracted_images = extractedImageUrls;

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

  // Update record as completed
  await supabase
    .from("mstc_auctions")
    .update({
      asset_status: "completed",
      sanitized_document_path: catalogUrl,
      raw_materials_text: rawMaterialsText,
      error_log: null,
    })
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
      "id, mstc_auction_number, source_pdf_url, retry_count, category_name, seller_name, location, raw_materials_text",
    )
    .or("asset_status.eq.pending,asset_status.eq.failed")
    .lt("retry_count", MAX_RETRY_COUNT)
    .limit(QUEUE_BATCH_SIZE);

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

  log.info(
    { batchSize: executableQueue.length },
    "Processing queue batch",
  );

  for (const record of executableQueue as QueueRecord[]) {
    // Row-Lock: Set state to processing immediately
    await supabase
      .from("mstc_auctions")
      .update({ asset_status: "processing" })
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

async function startWorker(): Promise<void> {
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

startWorker();
