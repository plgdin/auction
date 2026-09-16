/**
 * GeM Official Document Generation and Supabase Storage Ingestion Service
 * 
 * Renders official, executive A4 PDF documents from GeM notice HTML,
 * downloads external attachments, and uploads them to Supabase Storage
 * for reliable, persistent, high-speed CDN delivery.
 */
import type { Browser } from "puppeteer";
import { createRequire } from "module";
import { uploadToStorage, checkFileExistsInStorage } from "../common/storage.js";
import { logger } from "../common/logger.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const log = logger.child({ module: "gemDocumentService" });

export interface GemDocumentResult {
  publicUrl: string;
  extractedText: string;
  previewUrl: string | null;
}

/**
 * Transforms raw GeM portal notice HTML into an executive, print-ready document template.
 */
export function buildOfficialNoticeHtml(
  rawNoticeHtml: string,
  auctionId: string,
  title?: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GeM Official Auction Notice - ${auctionId}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm 15mm 12mm;
      @bottom-right {
        content: counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #64748b;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.45;
      font-size: 10.5px;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .official-header {
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .official-title {
      font-size: 19px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .official-subtitle {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      margin-top: 3px;
    }
    .badge-wrap {
      text-align: right;
    }
    .badge {
      display: inline-block;
      background: #e0e7ff;
      color: #3730a3;
      padding: 4px 9px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.5px;
      border: 1px solid #c7d2fe;
    }
    .ref-badge {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 3px;
      font-family: monospace;
      font-weight: bold;
    }
    /* Hide portal chrome, navigation bars, login/sign buttons, footer */
    header, nav, footer, .top-header, .navbar, .login-btn, .btn-back, 
    .button-div, .back-btn, #header, #footer, .bread-crumb,
    a[href*='login'], a[href*='sign'], a[href*='download-document'] {
      display: none !important;
    }
    /* Table styling */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-bottom: 14px !important;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      border: 1px solid #cbd5e1 !important;
      padding: 6px 8px !important;
      font-size: 10px !important;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #1e293b !important;
      font-weight: 700 !important;
      text-transform: uppercase;
    }
    /* Section Headings */
    h2, h3, h4, .panel-heading, .title-header, .epnew-form-heading {
      color: #0f172a;
      font-weight: 700;
      margin-top: 14px;
      margin-bottom: 8px;
      font-size: 11.5px;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .caption, label.caption {
      font-weight: bold;
      color: #334155;
    }
    .control-label {
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="official-header">
    <div>
      <div class="official-title">Government e-Marketplace (GeM)</div>
      <div class="official-subtitle">Official Forward e-Auction Notice & Schedule Document</div>
      ${title ? `<div style="font-weight:bold; color:#1e293b; margin-top:4px; font-size:11px;">Item: ${title}</div>` : ""}
    </div>
    <div class="badge-wrap">
      <span class="badge">OFFICIAL NOTICE DOCUMENT</span>
      <div class="ref-badge">AUCTION ID: ${auctionId}</div>
    </div>
  </div>
  <div id="notice-body">
    ${rawNoticeHtml}
  </div>
</body>
</html>`;
}

/**
 * Renders HTML content to a clean, professional A4 PDF buffer using Puppeteer.
 */
export async function renderNoticeHtmlToPdf(
  browser: Browser,
  styledHtml: string
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    // Set content and wait for network/layout idle
    await page.setContent(styledHtml, { waitUntil: "load" });

    // Clean any interfering scripts, styles, or external widgets inside the DOM
    await page.evaluate(() => {
      document.querySelectorAll("script, noscript, iframe").forEach((el) => el.remove());
      const unwanted = document.querySelectorAll(
        "header, footer, nav, .header, .footer, .navbar, .top-nav, .bread-crumb, .button-div, .back-btn, #header, #footer"
      );
      unwanted.forEach((el) => el.remove());
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "12mm", bottom: "15mm", left: "12mm" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Generates an official notice PDF from GeM notice HTML and uploads it directly to Supabase Storage.
 * Returns the permanent Supabase public URL.
 */
export async function generateAndUploadGemNoticePdf(
  browser: Browser,
  auctionId: string,
  noticeHtml: string,
  title?: string,
  forceRefresh = false
): Promise<GemDocumentResult> {
  const storagePath = `gem-documents/GeM_Notice_${auctionId}.pdf`;

  // 1. Check if already uploaded and cached in Supabase Storage
  if (!forceRefresh) {
    try {
      const { exists, publicUrl } = await checkFileExistsInStorage(storagePath);
      if (exists && publicUrl) {
        log.debug({ auctionId, publicUrl }, "GeM notice PDF already exists in Supabase Storage");
        return { publicUrl, extractedText: "", previewUrl: null };
      }
    } catch {
      // Continue to generation on check failure
    }
  }

  // 2. Render official PDF buffer
  log.info({ auctionId }, "Rendering official GeM notice PDF document...");
  const styledHtml = buildOfficialNoticeHtml(noticeHtml, auctionId, title);
  const pdfBuffer = await renderNoticeHtmlToPdf(browser, styledHtml);

  // 3. Upload to Supabase Storage
  log.info(
    { auctionId, byteLength: pdfBuffer.length },
    "Uploading official GeM notice PDF to Supabase Storage..."
  );
  const publicUrl = await uploadToStorage(storagePath, pdfBuffer, "application/pdf");
  log.info({ auctionId, publicUrl }, "Successfully uploaded GeM notice PDF to Supabase Storage");

  // 4. Extract searchable text from the generated PDF
  let extractedText = "";
  try {
    const parsedPdf = await pdfParse(pdfBuffer);
    if (parsedPdf && parsedPdf.text) {
      extractedText = parsedPdf.text.trim();
      log.debug(
        { auctionId, textLength: extractedText.length },
        "Extracted searchable text from GeM notice PDF"
      );
    }
  } catch (err: any) {
    log.warn({ auctionId, error: err.message }, "Non-critical: pdf-parse failed on generated PDF");
  }

  // 5. Generate preview thumbnail (first page → JPEG)
  let previewUrl: string | null = null;
  try {
    const page = await browser.newPage();
    try {
      await page.setContent(styledHtml, { waitUntil: "load" });
      await page.setViewport({ width: 800, height: 1100 });
      const screenshotBuffer = await page.screenshot({
        type: "jpeg",
        quality: 85,
        clip: { x: 0, y: 0, width: 800, height: 1100 },
      });
      const previewPath = `gem-previews/GeM_Preview_${auctionId}.jpg`;
      previewUrl = await uploadToStorage(
        previewPath,
        Buffer.from(screenshotBuffer),
        "image/jpeg"
      );
      log.info({ auctionId, previewUrl }, "Preview thumbnail generated and uploaded");
    } finally {
      await page.close().catch(() => {});
    }
  } catch (prevErr: any) {
    log.warn({ auctionId, error: prevErr.message }, "Non-critical: preview generation failed");
  }

  return { publicUrl, extractedText, previewUrl };
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
    const extension = fileUrl.split(".").pop()?.toLowerCase() || "pdf";
    const safeExt = ["pdf", "zip", "doc", "docx", "xls", "xlsx"].includes(extension) ? extension : "pdf";
    const storagePath = `gem-documents/GeM_Attachment_${auctionId}_${index}.${safeExt}`;

    // Check if exists
    const { exists, publicUrl } = await checkFileExistsInStorage(storagePath);
    if (exists && publicUrl) {
      return publicUrl;
    }

    // Fetch buffer via in-browser context to reuse session
    const page = await browser.newPage();
    try {
      const base64Data = await page.evaluate(async (url: string) => {
        const res = await fetch(url);
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
