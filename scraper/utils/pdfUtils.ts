/**
 * PDF processing utilities.
 *
 * Handles rendering PDF pages to images via Puppeteer and extracting
 * embedded JPEG streams from raw PDF binary data.
 */
import puppeteer from "puppeteer";
import { MAX_EMBEDDED_IMAGES, MIN_IMAGE_BYTE_SIZE } from "../config.js";
import { logger } from "./logger.js";

const log = logger.child({ module: "pdfUtils" });

/**
 * Render the first page of a PDF buffer as a JPEG image using Puppeteer + pdf.js.
 *
 * @param fileBuffer - The raw PDF file buffer.
 * @returns A JPEG image buffer, or `null` if rendering fails.
 */
export async function renderPdfFirstPage(
  fileBuffer: Buffer,
): Promise<Buffer | null> {
  let browser = null;
  try {
    const pdfBase64 = fileBuffer.toString("base64");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        </script>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
      </body>
      </html>
    `);

    const dataUrl = await page.evaluate(async (base64Data) => {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
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
    if (browser) {
      await browser.close();
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
