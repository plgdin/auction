/**
 * PDF processing utilities.
 *
 * Handles rendering PDF pages to images via Puppeteer and extracting
 * embedded JPEG streams from raw PDF binary data.
 *
 * Fixes applied:
 * - Shared browser singleton: all render calls reuse the same Chromium instance.
 * - Auto-restart on crash with graceful shutdown on process exit.
 * - Reduced memory overhead from repeated browser launches.
 */
import puppeteer, { Browser } from "puppeteer";
import { createRequire } from "module";
import { MAX_EMBEDDED_IMAGES, MIN_IMAGE_BYTE_SIZE } from "../config.js";
import { logger } from "./logger.js";

const require = createRequire(import.meta.url);
const log = logger.child({ module: "pdfUtils" });

// ─── Browser Singleton ───────────────────────────────────────────────────────

let browserInstance: Browser | null = null;
let browserInitializing: Promise<Browser> | null = null;

/**
 * Get or initialize the shared Puppeteer browser instance.
 * Thread-safe: concurrent calls wait for the same initialization promise.
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  if (browserInitializing) return browserInitializing;

  browserInitializing = (async () => {
    try {
      log.info({}, "Launching shared Puppeteer browser instance");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      // Auto-restart on disconnect
      browser.on("disconnected", () => {
        log.warn({}, "Browser disconnected — will reinitialize on next request");
        browserInstance = null;
        browserInitializing = null;
      });

      browserInstance = browser;
      browserInitializing = null;
      return browser;
    } catch (err: any) {
      log.error({ errorMessage: err.message }, "Failed to launch browser");
      browserInitializing = null;
      throw err;
    }
  })();

  return browserInitializing;
}

/**
 * Close the shared browser instance (call on process exit).
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
      log.info({}, "Shared browser closed");
    } catch (err: any) {
      log.warn({ errorMessage: err.message }, "Error closing browser");
    }
    browserInstance = null;
    browserInitializing = null;
  }
}

// Register cleanup on process exit
process.on("beforeExit", () => {
  closeBrowser().catch(() => {});
});
process.on("SIGINT", () => {
  closeBrowser()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});

// ─── PDF.js Rendering Helpers ────────────────────────────────────────────────

/**
 * The HTML template injected into Puppeteer pages for PDF.js rendering.
 */
const PDF_JS_HTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js"></script>
    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      if (pdfjsLib.VerbosityLevel) {
        pdfjsLib.verbosity = pdfjsLib.VerbosityLevel.ERRORS;
      }
    </script>
  </head>
  <body>
    <canvas id="pdf-canvas"></canvas>
  </body>
  </html>
`;

/**
 * Render the first page of a PDF buffer as a JPEG image using the shared browser.
 *
 * @param fileBuffer - The raw PDF file buffer.
 * @returns A JPEG image buffer, or `null` if rendering fails.
 */
export async function renderPdfFirstPage(
  fileBuffer: Buffer,
): Promise<Buffer | null> {
  let page = null;
  try {
    const pdfBase64 = fileBuffer.toString("base64");
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });
    await page.setContent(PDF_JS_HTML);

    const dataUrl = await page.evaluate(async (base64Data) => {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes, verbosity: 0 });
      const pdfDoc = await loadingTask.promise;
      const pdfPage = await pdfDoc.getPage(1);
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const canvas = document.getElementById(
        "pdf-canvas",
      ) as HTMLCanvasElement;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) throw new Error("Failed to get 2d context");
      await pdfPage.render({ canvasContext, viewport }).promise;
      return canvas.toDataURL("image/jpeg", 0.85);
    }, pdfBase64);

    const base64Image = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    return Buffer.from(base64Image, "base64");
  } catch (err: any) {
    log.error(
      { errorMessage: err.message },
      "Failed to render PDF page to image",
    );
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Extract embedded JPEG images from raw PDF binary data by scanning
 * for `/Subtype /Image` + `/Filter /DCTDecode` stream objects.
 *
 * @param pdfBuffer - Raw PDF file buffer.
 * @returns Array of JPEG image buffers.
 */
export function extractEmbeddedJpegs(pdfBuffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;

  while (pos < pdfBuffer.length && jpegs.length < MAX_EMBEDDED_IMAGES) {
    const streamIdx = pdfBuffer.indexOf("stream", pos);
    if (streamIdx === -1) break;

    const dictStart = pdfBuffer.lastIndexOf("<<", streamIdx);
    if (dictStart !== -1) {
      const dictBuffer = pdfBuffer.slice(dictStart, streamIdx);
      const dictStr = dictBuffer.toString("ascii");

      if (
        dictStr.includes("/Subtype /Image") &&
        dictStr.includes("/Filter /DCTDecode")
      ) {
        const endstreamIdx = pdfBuffer.indexOf("endstream", streamIdx);
        if (endstreamIdx !== -1) {
          let start = streamIdx + 6;
          while (
            start < endstreamIdx &&
            (pdfBuffer[start] === 10 || pdfBuffer[start] === 13)
          ) {
            start++;
          }
          let end = endstreamIdx;
          while (
            end > start &&
            (pdfBuffer[end - 1] === 10 || pdfBuffer[end - 1] === 13)
          ) {
            end--;
          }

          const streamData = pdfBuffer.slice(start, end);
          if (streamData.length > MIN_IMAGE_BYTE_SIZE) {
            jpegs.push(streamData);
          }
        }
      }
    }
    pos = streamIdx + 6;
  }

  return jpegs;
}

export interface RenderedPage {
  pageNumber: number;
  text: string;
  imageBuffer: Buffer;
  /** Whether this page contains embedded image XObjects (scanned content). */
  hasImages: boolean;
}

/**
 * Render multiple pages of a PDF and extract text per page using the shared browser.
 *
 * @param fileBuffer - Raw PDF file buffer.
 * @param maxPages - Maximum number of pages to process.
 * @returns Array of RenderedPage objects.
 */
export async function renderAndExtractPdfPages(
  fileBuffer: Buffer,
  maxPages = 20,
): Promise<RenderedPage[]> {
  let page = null;
  try {
    const pdfBase64 = fileBuffer.toString("base64");
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });
    await page.setContent(PDF_JS_HTML);

    const pagesResult = await page.evaluate(
      async (base64Data, maxP) => {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const loadingTask = (window as any).pdfjsLib.getDocument({
          data: bytes,
          verbosity: 0,
        });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        const limit = Math.min(numPages, maxP);
        const results = [];

        const canvas = document.getElementById(
          "pdf-canvas",
        ) as HTMLCanvasElement;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) throw new Error("Failed to get 2d context");

        for (let pNum = 1; pNum <= limit; pNum++) {
          const pdfPage = await pdfDoc.getPage(pNum);

          // 1. Extract text content via PDF.js
          const textContent = await pdfPage.getTextContent();
          let pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");

          // 2. Detect embedded images via operator list
          //    OPS.paintImageXObject = 85 in PDF.js
          let hasImages = false;
          try {
            const opList = await pdfPage.getOperatorList();
            hasImages = opList.fnArray.some((op: number) => op === 85);
          } catch (_opErr) {
            // Operator list extraction failed, assume no images
          }

          // 3. Render to canvas and get data URL
          const viewport = pdfPage.getViewport({ scale: 1.5 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvasContext.clearRect(0, 0, canvas.width, canvas.height);
          await pdfPage.render({ canvasContext, viewport }).promise;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

          // 4. Fallback to Tesseract OCR if text is empty or too short (scanned PDF)
          if (!pageText || pageText.trim().length < 50) {
            try {
              const ocrRes = await (window as any).Tesseract.recognize(canvas, 'eng');
              if (ocrRes && ocrRes.data && ocrRes.data.text) {
                pageText = ocrRes.data.text;
              }
            } catch (ocrErr) {
              console.error("Scanned PDF OCR failed on page " + pNum, ocrErr);
            }
          }

          results.push({
            pageNumber: pNum,
            text: pageText,
            dataUrl,
            hasImages,
          });
        }
        return results;
      },
      pdfBase64,
      maxPages,
    );

    const renderedPages: RenderedPage[] = [];
    for (const res of pagesResult) {
      const base64Image = res.dataUrl.replace(
        /^data:image\/jpeg;base64,/,
        "",
      );
      renderedPages.push({
        pageNumber: res.pageNumber,
        text: res.text,
        imageBuffer: Buffer.from(base64Image, "base64"),
        hasImages: res.hasImages ?? false,
      });
    }
    return renderedPages;
  } catch (err: any) {
    log.error(
      { errorMessage: err.message },
      "Failed to render and extract PDF pages",
    );
    return [];
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Extract text page-by-page from a PDF buffer using native pdf-parse.
 * Completely local, zero Puppeteer / Chromium overhead.
 *
 * @param fileBuffer - Raw PDF file buffer.
 * @returns Array of pages with pageNumber and text.
 */
export async function extractPdfTextNatively(
  fileBuffer: Buffer
): Promise<{ pageNumber: number; text: string }[]> {
  const pages: { pageNumber: number; text: string }[] = [];
  
  try {
    const pdf = require("pdf-parse");
    await pdf(fileBuffer, {
      pagerender: async (pageData: any) => {
        try {
          const textContent = await pageData.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false,
          });
          
          let lastY = 0;
          let text = "";
          for (const item of textContent.items) {
            if (lastY === item.transform[5] || !lastY) {
              text += item.str + " ";
            } else {
              text += "\n" + item.str + " ";
            }
            lastY = item.transform[5];
          }
          
          pages.push({
            pageNumber: (pageData.pageIndex || 0) + 1,
            text: text,
          });
          
          return text;
        } catch (err) {
          return "";
        }
      }
    });
    
    return pages.sort((a, b) => a.pageNumber - b.pageNumber);
  } catch (err: any) {
    log.error({ errorMessage: err.message }, "Failed native pdf-parse extraction");
    return [];
  }
}
