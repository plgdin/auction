/**
 * GeM Authentic Document Ingestion & Storage Service
 *
 * Downloads the genuine official government auction documents from the
 * GeM Forward Auction portal (/eprocure/eauction-download-document/<id>/...),
 * verifies binary integrity (%PDF magic bytes), extracts OCR/selectable text,
 * renders page-1 preview thumbnails, extracts itemized BOQ schedules,
 * and uploads them to Supabase Storage for persistent, zero-latency CDN delivery.
 */
import type { Browser, Page } from "puppeteer";
import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { uploadToStorage, checkFileExistsInStorage } from "../common/storage.js";
import { logger } from "../common/logger.js";
import { STORAGE_BUCKET, DEFAULT_USER_AGENT } from "../../config.js";
import { renderPdfFirstPage } from "../pdfUtils.js";
import { performOcrWithDetails } from "../ocrUtils.js";
import { parseGemNoticeText, type BoqItem } from "../../parsers/gem/gemNoticeTextParser.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const log = logger.child({ module: "gemDocumentService" });

export interface RealGemDocumentResult {
  publicUrl: string;
  previewUrl: string | null;
  extractedText: string;
  boqItems: BoqItem[];
  filename: string;
  sizeBytes?: number;
  sizeMb?: string;
  approvalDateTime?: string;
  description?: string;
}

export interface AuctionDocumentsResult {
  documents: RealGemDocumentResult[];
  primaryDocUrl: string | null;
  primaryPreviewUrl: string | null;
  combinedText: string;
  combinedBoqItems: BoqItem[];
  discoveredAttachments: Array<{
    name: string;
    size?: string;
    url: string;
    approval_date?: string;
    description?: string;
  }>;
  inspectionDate: string | null;
  inspectionLocation: string | null;
  inspectionContact: string | null;
}

/**
 * Validates that buffer starts with the `%PDF` (0x25 0x50 0x44 0x46) magic bytes.
 */
export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 32) return false;
  return buffer.subarray(0, 4).toString("utf-8") === "%PDF";
}

/**
 * Validates that buffer is a known image format (JPEG, PNG).
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  return false;
}

/**
 * Downloads a single authentic document from the GeM portal using the active browser session.
 */
async function downloadFileFromPage(
  page: Page,
  auctionId: string,
  downloadHref: string,
  downloadSelector?: string
): Promise<{ buffer: Buffer; filename: string }> {
  // Method 1: If direct href exists, fetch in-session via page.evaluate
  if (downloadHref && !downloadHref.startsWith("javascript:") && downloadHref !== "#") {
    const absoluteUrl = downloadHref.startsWith("http")
      ? downloadHref
      : `https://forwardauction.gem.gov.in${downloadHref.startsWith("/") ? "" : "/"}${downloadHref}`;

    log.debug({ auctionId, url: absoluteUrl }, "Attempting in-session buffer fetch...");

    const base64Data = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      } catch {
        return null;
      }
    }, absoluteUrl);

    if (base64Data) {
      const buf = Buffer.from(base64Data, "base64");
      if (isValidPdfBuffer(buf) || isValidImageBuffer(buf)) {
        let filename = path.basename(new URL(absoluteUrl).pathname) || `GeM_${auctionId}_Notice.pdf`;
        if (!filename.includes(".")) filename += ".pdf";
        return { buffer: buf, filename };
      }
    }
  }

  // Method 2: CDP download behavior interception (handles onclick, JS redirects, form posts)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `gem-dl-${auctionId}-`));
  try {
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: tempDir,
    });

    log.debug({ auctionId, selector: downloadSelector }, "Triggering CDP download click...");

    // Click the download element
    if (downloadSelector) {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (el) el.click();
      }, downloadSelector);
    } else {
      await page.evaluate(() => {
        const link = document.querySelector(
          "table a, a[href*='download'], a[href*='Download'], a[href*='.pdf'], .btn-download"
        ) as HTMLElement;
        if (link) link.click();
      });
    }

    // Wait for the downloaded file to appear (polling up to 15 seconds)
    const startTime = Date.now();
    let downloadedFilePath = "";

    while (Date.now() - startTime < 15000) {
      const files = fs.readdirSync(tempDir).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
      if (files.length > 0) {
        downloadedFilePath = path.join(tempDir, files[0]);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      const fileBuffer = fs.readFileSync(downloadedFilePath);
      const filename = path.basename(downloadedFilePath);
      return { buffer: fileBuffer, filename };
    }
  } catch (cdpErr: any) {
    log.warn({ auctionId, error: cdpErr.message }, "CDP download interception encountered error");
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  throw new Error("Failed to download genuine document via both in-session fetch and CDP");
}

/**
 * Downloads all authentic documents from an auction's Download Document page,
 * uploads them to Supabase Storage, and extracts full OCR and BOQ intelligence.
 */
export async function downloadAndProcessGemDocuments(
  browser: Browser,
  page: Page,
  auctionId: string,
  docPageUrl: string,
  force = false
): Promise<AuctionDocumentsResult> {
  const result: AuctionDocumentsResult = {
    documents: [],
    primaryDocUrl: null,
    primaryPreviewUrl: null,
    combinedText: "",
    combinedBoqItems: [],
    discoveredAttachments: [],
    inspectionDate: null,
    inspectionLocation: null,
    inspectionContact: null,
  };

  const cleanAuctionId = auctionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const targetDocPageUrl = docPageUrl.startsWith("http")
    ? docPageUrl
    : `https://forwardauction.gem.gov.in${docPageUrl.startsWith("/") ? "" : "/"}${docPageUrl}`;

  log.info({ auctionId, url: targetDocPageUrl }, "Navigating to GeM Download Document page...");

  await page.goto(targetDocPageUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  }).catch((err) => {
    log.warn({ auctionId, error: err.message }, "Navigation to doc page had timeout/warning");
  });

  // Extract table rows from download page
  const docRows = await page.evaluate(() => {
    const rowsData: Array<{
      index: number;
      description: string;
      sizeMb: string;
      approvalDateTime: string;
      href: string;
      hasClick: boolean;
    }> = [];

    const tables = Array.from(document.querySelectorAll("table"));
    const docTable = tables.find((t) =>
      /Document\s*Description|Size\s*\(MB\)|Action/i.test(t.innerText)
    );

    if (!docTable) {
      // Fallback: search for any download links on the page
      const downloadLinks = Array.from(
        document.querySelectorAll("a[href*='download'], a[href*='Download'], a[href*='.pdf']")
      );
      downloadLinks.forEach((l, idx) => {
        const anchor = l as HTMLAnchorElement;
        rowsData.push({
          index: idx,
          description: anchor.innerText?.trim() || "Auction Document",
          sizeMb: "",
          approvalDateTime: "",
          href: anchor.getAttribute("href") || "",
          hasClick: false,
        });
      });
      return rowsData;
    }

    const trs = Array.from(docTable.querySelectorAll("tr")).filter((r) => !r.querySelector("th"));
    trs.forEach((tr, idx) => {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (tds.length >= 3) {
        const desc = tds[1]?.innerText?.trim() || "GeM Forward Auction Document";
        const size = tds[2]?.innerText?.trim() || "";
        const approval = tds[3]?.innerText?.trim() || "";
        const actionLink = tr.querySelector("a, button");
        const href = actionLink ? actionLink.getAttribute("href") || "" : "";
        const hasClick = actionLink ? Boolean(actionLink.getAttribute("onclick")) : false;

        rowsData.push({
          index: idx,
          description: desc,
          sizeMb: size,
          approvalDateTime: approval,
          href,
          hasClick,
        });
      }
    });

    return rowsData;
  });

  log.info({ auctionId, count: docRows.length }, "Discovered document rows on GeM download page");

  if (docRows.length === 0) {
    log.warn({ auctionId }, "No document rows found on GeM download page");
    return result;
  }

  for (let i = 0; i < docRows.length; i++) {
    const row = docRows[i];
    const docIndex = i + 1;
    const storagePathPrefix = `gem-documents/${cleanAuctionId}`;

    try {
      // Check cache first
      let cachedPublicUrl: string | undefined;
      if (!force) {
        const { exists, publicUrl } = await checkFileExistsInStorage(
          `${storagePathPrefix}/document_${docIndex}.pdf`
        );
        if (exists && publicUrl) {
          cachedPublicUrl = publicUrl;
        }
      }

      let fileBuffer: Buffer | null = null;
      let finalFilename = `document_${docIndex}.pdf`;

      if (cachedPublicUrl) {
        log.info({ auctionId, docIndex, publicUrl: cachedPublicUrl }, "Document already cached in storage");
        result.documents.push({
          publicUrl: cachedPublicUrl,
          previewUrl: null,
          extractedText: "",
          boqItems: [],
          filename: finalFilename,
          sizeMb: row.sizeMb,
          approvalDateTime: row.approvalDateTime,
          description: row.description,
        });
        result.discoveredAttachments.push({
          name: row.description || finalFilename,
          size: row.sizeMb ? (row.sizeMb.includes("MB") || row.sizeMb.includes("KB") ? row.sizeMb : `${row.sizeMb} MB`) : undefined,
          url: cachedPublicUrl,
          approval_date: row.approvalDateTime || undefined,
          description: row.description,
        });
        if (!result.primaryDocUrl) result.primaryDocUrl = cachedPublicUrl;
        continue;
      }

      // Download file using page session
      const selector = `table tr:nth-of-type(${i + 2}) a, table tr:nth-of-type(${i + 2}) button`;
      const downloadResult = await downloadFileFromPage(page, auctionId, row.href, selector);
      fileBuffer = downloadResult.buffer;
      if (downloadResult.filename) {
        finalFilename = downloadResult.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      }

      // Format validation
      const isPdf = isValidPdfBuffer(fileBuffer);
      const isImg = isValidImageBuffer(fileBuffer);

      if (!isPdf && !isImg) {
        const previewStr = fileBuffer.subarray(0, 200).toString("utf-8");
        if (previewStr.includes("<html") || previewStr.includes("Session Expired")) {
          throw new Error("Downloaded content was an HTML session error page instead of authentic document");
        }
        throw new Error("Downloaded file failed %PDF magic byte validation");
      }

      const contentType = isPdf ? "application/pdf" : "image/jpeg";
      const storagePath = `${storagePathPrefix}/${finalFilename}`;

      // Upload genuine document to Supabase Storage
      log.info({ auctionId, storagePath, bytes: fileBuffer.length }, "Uploading genuine document to Supabase Storage...");
      const publicUrl = await uploadToStorage(storagePath, fileBuffer, contentType);
      log.info({ auctionId, publicUrl }, "Successfully uploaded document to Supabase Storage");

      // Extract text via pdf-parse
      let extractedText = "";
      if (isPdf) {
        try {
          const parsed = await pdfParse(fileBuffer);
          if (parsed && parsed.text) {
            extractedText = parsed.text.trim();
          }
        } catch (pdfErr: any) {
          log.warn({ auctionId, error: pdfErr.message }, "pdf-parse text extraction skipped");
        }

        // OCR fallback for scanned PDFs (e.g. government stamped notices)
        if (extractedText.length < 100) {
          log.info({ auctionId, textLength: extractedText.length }, "PDF appears scanned. Running OCR fallback...");
          try {
            const previewBuf = await renderPdfFirstPage(fileBuffer);
            if (previewBuf) {
              const ocrRes = await performOcrWithDetails(previewBuf);
              if (ocrRes && ocrRes.text && ocrRes.text.length > extractedText.length) {
                extractedText = ocrRes.text;
                log.info({ auctionId, ocrLength: ocrRes.text.length }, "OCR extracted text from scanned notice");
              }
            }
          } catch (ocrErr: any) {
            log.warn({ auctionId, error: ocrErr.message }, "OCR fallback skipped on error");
          }
        }
      }

      // Generate page-1 preview image thumbnail
      let previewUrl: string | null = null;
      if (isPdf) {
        try {
          const previewBuf = await renderPdfFirstPage(fileBuffer);
          if (previewBuf) {
            const previewPath = `gem-previews/${cleanAuctionId}_${docIndex}.jpg`;
            previewUrl = await uploadToStorage(previewPath, previewBuf, "image/jpeg");
            log.info({ auctionId, previewUrl }, "Uploaded page-1 preview thumbnail to Supabase Storage");
          }
        } catch (prevErr: any) {
          log.warn({ auctionId, error: prevErr.message }, "Preview thumbnail rendering skipped");
        }
      }

      // Extract itemized BOQ schedule and inspection details from text
      let boqItems: BoqItem[] = [];
      if (extractedText.length > 30) {
        try {
          const intel = parseGemNoticeText(extractedText);
          boqItems = intel.boqItems || [];
          if (boqItems.length > 0) {
            log.info({ auctionId, count: boqItems.length }, "Extracted BOQ schedule items from document text");
          }
          if (!result.inspectionDate && intel.inspectionDate) {
            result.inspectionDate = intel.inspectionDate;
          }
          if (!result.inspectionLocation && intel.inspectionLocation) {
            result.inspectionLocation = intel.inspectionLocation;
          }
          if (!result.inspectionContact && intel.inspectionContact) {
            result.inspectionContact = intel.inspectionContact;
          }
        } catch {}
      }

      const docEntry: RealGemDocumentResult = {
        publicUrl,
        previewUrl,
        extractedText,
        boqItems,
        filename: finalFilename,
        sizeBytes: fileBuffer.length,
        sizeMb: row.sizeMb,
        approvalDateTime: row.approvalDateTime,
        description: row.description,
      };

      result.documents.push(docEntry);
      result.discoveredAttachments.push({
        name: row.description || finalFilename,
        size: row.sizeMb ? (row.sizeMb.includes("MB") || row.sizeMb.includes("KB") ? row.sizeMb : `${row.sizeMb} MB`) : undefined,
        url: publicUrl,
        approval_date: row.approvalDateTime || undefined,
        description: row.description,
      });

      if (!result.primaryDocUrl) result.primaryDocUrl = publicUrl;
      if (!result.primaryPreviewUrl && previewUrl) result.primaryPreviewUrl = previewUrl;
      if (extractedText) result.combinedText += "\n" + extractedText;
      if (boqItems.length > 0) result.combinedBoqItems.push(...boqItems);
    } catch (docErr: any) {
      log.error({ auctionId, docIndex, error: docErr.message }, "Failed to process genuine document row");
    }
  }

  return result;
}

/**
 * Downloads and mirrors official Corrigendum amendment PDFs to Supabase Storage.
 */
export async function archiveGemCorrigenda(
  page: Page,
  auctionId: string,
  corrigendumUrls: string[]
): Promise<string[]> {
  const archived: string[] = [];
  const cleanAuctionId = auctionId.replace(/[^a-zA-Z0-9_-]/g, "_");

  for (let i = 0; i < corrigendumUrls.length; i++) {
    const rawUrl = corrigendumUrls[i];
    if (!rawUrl) continue;
    if (rawUrl.includes("supabase.co")) {
      archived.push(rawUrl);
      continue;
    }

    try {
      const storagePath = `gem-documents/${cleanAuctionId}/Corrigendum_${i + 1}.pdf`;
      const { exists, publicUrl } = await checkFileExistsInStorage(storagePath);
      if (exists && publicUrl) {
        archived.push(publicUrl);
        continue;
      }

      const fullUrl = rawUrl.startsWith("http")
        ? rawUrl
        : `https://forwardauction.gem.gov.in${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;

      const res = await downloadFileFromPage(page, auctionId, fullUrl, "");
      if (res.buffer && isValidPdfBuffer(res.buffer)) {
        const uploaded = await uploadToStorage(storagePath, res.buffer, "application/pdf");
        archived.push(uploaded);
        log.info({ auctionId, index: i + 1, uploaded }, "Archived official Corrigendum PDF to storage");
      }
    } catch (err: any) {
      log.warn({ auctionId, index: i + 1, error: err.message }, "Corrigendum download skipped on error");
    }
  }

  return archived;
}

/**
 * Downloads an external GeM attachment/corrigendum and stores it permanently in Supabase Storage.
 */
export async function downloadAndUploadGemAttachment(
  browser: Browser,
  auctionId: string,
  fileUrl: string,
  index: number
): Promise<string | null> {
  try {
    const cleanAuctionId = auctionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const extension = fileUrl.split(".").pop()?.toLowerCase() || "pdf";
    const safeExt = ["pdf", "zip", "doc", "docx", "xls", "xlsx"].includes(extension) ? extension : "pdf";
    const storagePath = `gem-documents/${cleanAuctionId}/Corrigendum_${index}.${safeExt}`;

    // Check if exists
    const { exists, publicUrl } = await checkFileExistsInStorage(storagePath);
    if (exists && publicUrl) {
      return publicUrl;
    }

    const page = await browser.newPage();
    try {
      const base64Data = await page.evaluate(async (url: string) => {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }, fileUrl);

      if (!base64Data) return null;

      const fileBuffer = Buffer.from(base64Data, "base64");
      const contentType = safeExt === "pdf" ? "application/pdf" : "application/octet-stream";
      return await uploadToStorage(storagePath, fileBuffer, contentType);
    } finally {
      await page.close().catch(() => {});
    }
  } catch (err: any) {
    log.warn({ auctionId, fileUrl, error: err.message }, "Failed to download GeM attachment file");
    return null;
  }
}
