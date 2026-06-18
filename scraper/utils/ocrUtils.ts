// @ts-ignore
import Tesseract from "tesseract.js";
import { logger } from "./logger.js";

const log = logger.child({ module: "ocrUtils" });

/**
 * Perform Optical Character Recognition (OCR) on an image buffer.
 *
 * @param imageBuffer - The buffer of the image (JPEG/PNG).
 * @returns The extracted text, or an empty string if OCR fails.
 */
export async function performOcr(imageBuffer: Buffer): Promise<string> {
  try {
    const worker = await Tesseract.createWorker("eng");
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return text || "";
  } catch (err: any) {
    log.error({ errorMessage: err.message }, "OCR recognition failed");
    return "";
  }
}
