// @ts-ignore
import Tesseract from "tesseract.js";
import { logger } from "./logger.js";
import { parseImageWithVisionLLM } from "./visionLlm.js";

const log = logger.child({ module: "ocrUtils" });

/**
 * Checks if the OCR text looks like gibberish or has significant non-English characters.
 */
function isGibberishOrForeign(text: string): boolean {
  if (!text || text.trim() === '') return true;

  // 1. Check for high density of strange characters common in OCR failure
  const weirdChars = text.match(/[~`|^@#{}()[\]\\\/\>\<]/g);
  if (weirdChars && weirdChars.length > text.length * 0.15) {
    return true; // Too many weird characters
  }

  // 2. Check for high density of non-Latin characters (which Tesseract eng fails on)
  // This helps catch Hindi or other languages that got mangled or passed through
  const nonLatinChars = text.match(/[^\x00-\x7F]/g);
  if (nonLatinChars && nonLatinChars.length > text.length * 0.03) {
    return true; // Over 3% non-Latin (Hindi, Unicode artifacts, etc)
  }

  // 3. Gibberish word ratio check
  const words = text.split(/\s+/).filter(w => w.length > 2);
  let gibberishWords = 0;
  for (const word of words) {
    // Words with no vowels or too many consonants in a row are often OCR gibberish
    if (!/[aeiouyAEIOUY]/.test(word) || /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(word)) {
      gibberishWords++;
    }
  }

  if (words.length > 0 && (gibberishWords / words.length) > 0.4) {
    return true; // >40% of words look like pure gibberish
  }

  return false;
}

/**
 * Perform Optical Character Recognition (OCR) on an image buffer.
 * Automatically falls back to Vision LLM if classical OCR fails or produces gibberish.
 *
 * @param imageBuffer - The buffer of the image (JPEG/PNG).
 * @returns An object containing the raw text (if successful) or the LLM JSON (if fallback triggered).
 */
export async function performOcr(imageBuffer: Buffer): Promise<{ text: string, llmParsed?: any[] }> {
  try {
    const worker = await Tesseract.createWorker("eng");
    const { data: { text, confidence } } = await worker.recognize(imageBuffer);
    await worker.terminate();
    
    // Run the Gibberish Detector
    const isGib = isGibberishOrForeign(text);
    log.info({ isGibberish: isGib, confidence }, "OCR completed");
    if (isGib || confidence < 65) {
      log.warn({ confidence }, "Gibberish, non-English text, or low confidence detected in OCR. Falling back to Vision LLM.");
      const llmParsed = await parseImageWithVisionLLM(imageBuffer);
      log.info({ count: llmParsed.length }, "Vision LLM returned items");
      return { text: "", llmParsed };
    }

    return { text: text || "" };
  } catch (err: any) {
    log.error({ errorMessage: err.message }, "Classical OCR failed completely. Falling back to Vision LLM.");
    try {
      const llmParsed = await parseImageWithVisionLLM(imageBuffer);
      return { text: "", llmParsed };
    } catch (llmErr: any) {
      log.error({ errorMessage: llmErr.message }, "Vision LLM fallback also failed.");
      return { text: "" };
    }
  }
}
