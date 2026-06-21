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

export interface RenderedPage {
  pageNumber: number;
  text: string;
  imageBuffer: Buffer;
}

/**
 * Render multiple pages of a PDF and extract text per page.
 *
 * @param fileBuffer - Raw PDF file buffer.
 * @param maxPages - Maximum number of pages to process.
 * @returns Array of RenderedPage objects.
 */
export async function renderAndExtractPdfPages(
  fileBuffer: Buffer,
  maxPages = 20,
): Promise<RenderedPage[]> {
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

    const pagesResult = await page.evaluate(async (base64Data, maxP) => {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: bytes });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const limit = Math.min(numPages, maxP);
      const results = [];

      const canvas = document.getElementById("pdf-canvas") as HTMLCanvasElement;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) throw new Error("Failed to get 2d context");

      for (let pNum = 1; pNum <= limit; pNum++) {
        const pdfPage = await pdfDoc.getPage(pNum);
        
        // 1. Extract text content with Vector Coordinate Parsing
        const textContent = await pdfPage.getTextContent();
        
        const linesMap = new Map();
        for (const item of textContent.items) {
          if (!item.str || item.str.trim() === "") continue;
          
          const y = Math.round(item.transform[5]);
          const x = item.transform[4];
          
          // Group by Y with a tolerance of +/- 5
          let foundY = null;
          for (const key of linesMap.keys()) {
            if (Math.abs(key - y) <= 5) {
              foundY = key;
              break;
            }
          }
          if (foundY === null) {
            foundY = y;
            linesMap.set(foundY, []);
          }
          linesMap.get(foundY).push({ str: item.str, x });
        }

        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
        let pageText = "";
        for (const y of sortedY) {
          const lineItems = linesMap.get(y);
          lineItems.sort((a: any, b: any) => a.x - b.x);
          pageText += lineItems.map((item: any) => item.str.trim()).filter((s: string) => s).join(" ") + "\n";
        }
        
        // 2. Render to canvas and get data URL
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Clear canvas context
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        
        await pdfPage.render({ canvasContext, viewport }).promise;
        
        // --- Custom Computer Vision Grid Eraser ---
        try {
          const imgData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const width = canvas.width;
          const height = canvas.height;
          
          const hLines = [];
          for (let y = 0; y < height; y++) {
            let maxConsecutiveDark = 0;
            let currentConsecutiveDark = 0;
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4;
              if (data[idx] + data[idx+1] + data[idx+2] < 450) {
                currentConsecutiveDark++;
                if (currentConsecutiveDark > maxConsecutiveDark) {
                  maxConsecutiveDark = currentConsecutiveDark;
                }
              } else {
                currentConsecutiveDark = 0;
              }
            }
            if (maxConsecutiveDark > 150) {
              hLines.push(y);
            }
          }
          
          const vLines = [];
          for (let x = 0; x < width; x++) {
            let maxConsecutiveDark = 0;
            let currentConsecutiveDark = 0;
            for (let y = 0; y < height; y++) {
              const idx = (y * width + x) * 4;
              if (data[idx] + data[idx+1] + data[idx+2] < 450) {
                currentConsecutiveDark++;
                if (currentConsecutiveDark > maxConsecutiveDark) {
                  maxConsecutiveDark = currentConsecutiveDark;
                }
              } else {
                currentConsecutiveDark = 0;
              }
            }
            if (maxConsecutiveDark > 75) {
              vLines.push(x);
            }
          }
          
          canvasContext.fillStyle = "white";
          for (const y of hLines) {
            canvasContext.fillRect(0, y - 2, width, 5);
          }
          for (const x of vLines) {
            canvasContext.fillRect(x - 2, 0, 5, height);
          }
        } catch (e) {
          // Ignore canvas taint errors if any
        }
        // --- End of Grid Eraser ---
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        
        results.push({
          pageNumber: pNum,
          text: pageText,
          dataUrl,
        });
      }
      return results;
    }, pdfBase64, maxPages);

    const renderedPages: RenderedPage[] = [];
    for (const res of pagesResult) {
      const base64Image = res.dataUrl.replace(/^data:image\/jpeg;base64,/, "");
      renderedPages.push({
        pageNumber: res.pageNumber,
        text: res.text,
        imageBuffer: Buffer.from(base64Image, "base64"),
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
    if (browser) {
      await browser.close();
    }
  }
}

