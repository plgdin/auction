/**
 * OCR utilities with persistent worker pooling and smart skip logic.
 */
// @ts-ignore
import Tesseract from "tesseract.js";
import { createHash } from "crypto";
import { logger } from "../common/logger.js";
import { supabase } from "../common/storage.js";

const log = logger.child({ module: "ocrUtils" });

let workerInstance: any = null;
let workerInitializing: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (workerInstance) return workerInstance;
  if (workerInitializing) return workerInitializing;

  workerInitializing = (async () => {
    try {
      log.info({}, "Initializing persistent Tesseract OCR worker");
      const worker = await Tesseract.createWorker("eng");
      workerInstance = worker;
      log.info({}, "Tesseract worker initialized successfully");
      return worker;
    } catch (err: any) {
      log.error({ errorMessage: err.message }, "Failed to initialize Tesseract worker");
      workerInitializing = null;
      throw err;
    }
  })();

  return workerInitializing;
}

export async function terminateOcrWorker(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
      log.info({}, "Tesseract worker terminated");
    } catch (err: any) {
      log.warn({ errorMessage: err.message }, "Error terminating Tesseract worker");
    }
    workerInstance = null;
    workerInitializing = null;
  }
}

process.on("beforeExit", () => {
  terminateOcrWorker().catch(() => {});
});
process.on("SIGINT", () => {
  terminateOcrWorker().then(() => process.exit(0)).catch(() => process.exit(1));
});

const OCR_CACHE_MAX_SIZE = 100;
const ocrCache = new Map<string, string>();

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").substring(0, 16);
}

function cacheSet(key: string, value: string): void {
  if (ocrCache.size >= OCR_CACHE_MAX_SIZE) {
    const firstKey = ocrCache.keys().next().value;
    if (firstKey !== undefined) {
      ocrCache.delete(firstKey);
    }
  }
  ocrCache.set(key, value);
}

const LOT_STRUCTURAL_KEYWORDS = [
  "lot no", "lot name", "product type", "gst", "quantity",
  "start price", "bid increment", "category", "lot location",
];

export function shouldPerformOcr(
  selectableText: string,
): boolean {
  if (!selectableText) return true;

  const trimmed = selectableText.trim();
  if (trimmed.length < 400) return true;

  const words = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z]{3,}/.test(w));
  if (words.length < 40) return true;

  if (trimmed.length > 100) {
    const lower = trimmed.toLowerCase();
    const hasStructuralKeywords = LOT_STRUCTURAL_KEYWORDS.some(
      (kw) => lower.includes(kw),
    );
    if (!hasStructuralKeywords) return true;
  }

  return false;
}

export function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 100) {
    return false;
  }

  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  const isBmp = buffer[0] === 0x42 && buffer[1] === 0x4D;
  const isGif = buffer.toString("ascii", 0, 3) === "GIF";
  const isTiff = (buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4D && buffer[1] === 0x4D);

  return isJpeg || isPng || isWebp || isBmp || isGif || isTiff;
}

export async function performOcr(imageBuffer: Buffer): Promise<string> {
  if (!isValidImageBuffer(imageBuffer)) {
    log.warn(
      { bufferLength: imageBuffer?.length },
      "Skipping OCR: buffer is invalid, empty, or not a recognized image format"
    );
    return "";
  }

  const cacheKey = hashBuffer(imageBuffer);

  const cached = ocrCache.get(cacheKey);
  if (cached !== undefined) {
    log.debug({ cacheKey }, "OCR in-memory cache hit — returning cached result");
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from("ocr_cache")
      .select("ocr_text")
      .eq("buffer_hash", cacheKey)
      .maybeSingle();

    if (!error && data && data.ocr_text) {
      log.info({ cacheKey }, "OCR database cache hit — saving to memory and returning");
      const dbResult = data.ocr_text;
      cacheSet(cacheKey, dbResult);
      return dbResult;
    }
  } catch (dbErr: any) {
    log.warn({ errorMessage: dbErr.message, cacheKey }, "Error reading database OCR cache");
  }

  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    const result = text || "";

    cacheSet(cacheKey, result);

    (async () => {
      try {
        const { error } = await supabase
          .from("ocr_cache")
          .insert({ buffer_hash: cacheKey, ocr_text: result });
        if (error) {
          log.warn({ errorMessage: error.message, cacheKey }, "Failed to persist OCR cache in DB");
        } else {
          log.info({ cacheKey }, "OCR result persisted in database cache");
        }
      } catch (err: any) {
        log.warn({ errorMessage: err?.message, cacheKey }, "Failed to persist OCR cache in DB");
      }
    })();

    return result;
  } catch (err: any) {
    log.error({ errorMessage: err?.message || String(err) }, "OCR recognition failed");

    if (workerInstance) {
      workerInstance.terminate().catch(() => {});
    }
    workerInstance = null;
    workerInitializing = null;

    return "";
  }
}
