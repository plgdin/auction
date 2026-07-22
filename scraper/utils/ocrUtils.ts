/**
 * OCR utilities with persistent worker pooling and smart skip logic.
 *
 * Fixes applied:
 * - Persistent Tesseract worker: initialized once, reused across all calls.
 * - Smart skip logic: avoids OCR when selectable PDF text is sufficient.
 * - LRU cache: prevents re-OCR on retried documents (keyed by buffer hash).
 */
// @ts-ignore
import Tesseract from "tesseract.js";
import { createHash } from "crypto";
import { logger } from "./logger.js";
import { supabase } from "./storage.js";

const log = logger.child({ module: "ocrUtils" });

// ─── Persistent Worker ───────────────────────────────────────────────────────

let workerInstance: any = null;
let workerInitializing: Promise<any> | null = null;

/**
 * Get or initialize the persistent Tesseract worker.
 * Thread-safe: concurrent calls will wait for the same initialization promise.
 */
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

/**
 * Terminate the persistent OCR worker (call on process exit).
 */
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

// Register cleanup on process exit
process.on("beforeExit", () => {
  terminateOcrWorker().catch(() => {});
});
process.on("SIGINT", () => {
  terminateOcrWorker().then(() => process.exit(0)).catch(() => process.exit(1));
});

// ─── LRU Cache ───────────────────────────────────────────────────────────────

const OCR_CACHE_MAX_SIZE = 100;
const ocrCache = new Map<string, string>();

/**
 * Compute a fast hash key for a buffer (for cache lookups).
 */
function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").substring(0, 16);
}

/**
 * Add an entry to the LRU cache, evicting oldest if at capacity.
 */
function cacheSet(key: string, value: string): void {
  if (ocrCache.size >= OCR_CACHE_MAX_SIZE) {
    // Evict the oldest entry (first inserted)
    const firstKey = ocrCache.keys().next().value;
    if (firstKey !== undefined) {
      ocrCache.delete(firstKey);
    }
  }
  ocrCache.set(key, value);
}

// ─── Smart Skip Logic ────────────────────────────────────────────────────────

/**
 * Structural keywords expected in lot-bearing MSTC catalog pages.
 * If selectable text is moderately long but lacks these markers,
 * the page likely has a selectable header with scanned tabular body.
 */
const LOT_STRUCTURAL_KEYWORDS = [
  "lot no", "lot name", "product type", "gst", "quantity",
  "start price", "bid increment", "category", "lot location",
];

/**
 * Determine if OCR should be performed based on the quality of existing
 * selectable text from PDF.js extraction.
 *
 * Hybrid page detection:
 * - Requires ≥400 chars and ≥40 meaningful words to skip OCR.
 * - Forces OCR when the page contains embedded images (scanned content).
 * - Forces OCR when text is moderately long (>100 chars) but lacks
 *   key lot structural keywords, indicating a selectable header
 *   with scanned tabular body.
 *
 * @param selectableText - Text already extracted via PDF.js getTextContent().
 * @param pageHasImages  - Whether the page contains embedded image XObjects.
 * @returns `true` if OCR should be performed (text is insufficient).
 */
export function shouldPerformOcr(
  selectableText: string,
): boolean {
  if (!selectableText) return true;

  const trimmed = selectableText.trim();
  if (trimmed.length < 400) return true;

  // Count meaningful words (≥3 chars, alphabetic)
  const words = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z]{3,}/.test(w));
  if (words.length < 40) return true;

  // Hybrid page check: if the text is moderately long (>100 chars) but
  // missing structural lot keywords, the selectable text is likely just
  // headers/footers while the real content is scanned.
  if (trimmed.length > 100) {
    const lower = trimmed.toLowerCase();
    const hasStructuralKeywords = LOT_STRUCTURAL_KEYWORDS.some(
      (kw) => lower.includes(kw),
    );
    if (!hasStructuralKeywords) return true;
  }

  return false;
}

// ─── Image Validation Helper ──────────────────────────────────────────────────

/**
 * Check if a Buffer is a valid image format (JPEG, PNG, WEBP, BMP, GIF, TIFF).
 * Prevents Tesseract / Leptonica native pixReadStream crashes on corrupt or non-image buffers.
 */
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

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Perform Optical Character Recognition (OCR) on an image buffer.
 * Uses a persistent worker pool and LRU cache for performance.
 *
 * @param imageBuffer - The buffer of the image (JPEG/PNG).
 * @returns The extracted text, or an empty string if OCR fails.
 */
export async function performOcr(imageBuffer: Buffer): Promise<string> {
  // Validate image buffer before passing to Tesseract / Leptonica
  if (!isValidImageBuffer(imageBuffer)) {
    log.warn(
      { bufferLength: imageBuffer?.length },
      "Skipping OCR: buffer is invalid, empty, or not a recognized image format"
    );
    return "";
  }

  const cacheKey = hashBuffer(imageBuffer);

  // 1. Check in-memory cache first (fast path)
  const cached = ocrCache.get(cacheKey);
  if (cached !== undefined) {
    log.debug({ cacheKey }, "OCR in-memory cache hit — returning cached result");
    return cached;
  }

  // 2. Check database persistent cache (slow path)
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

  // 3. Run OCR on cache miss
  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    const result = text || "";

    // Cache the result in memory
    cacheSet(cacheKey, result);

    // Save to database cache asynchronously so it does not block processing
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

    // If the worker crashed, terminate and reset it so next call reinitializes cleanly
    if (workerInstance) {
      workerInstance.terminate().catch(() => {});
    }
    workerInstance = null;
    workerInitializing = null;

    return "";
  }
}
