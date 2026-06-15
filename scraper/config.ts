/**
 * Centralized configuration for the scraper/worker subsystem.
 * All magic numbers, external URLs, and business defaults are consolidated here
 * and sourced from environment variables where appropriate.
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

// ─── Database ────────────────────────────────────────────────────────────────

export const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ─── Worker Tuning ───────────────────────────────────────────────────────────

/** Maximum number of retry attempts before a job is marked as permanently failed. */
export const MAX_RETRY_COUNT = parseInt(
  process.env.WORKER_MAX_RETRIES || "3",
  10,
);

/** Maximum number of records to pull per polling cycle (throttle). */
export const QUEUE_BATCH_SIZE = parseInt(
  process.env.WORKER_BATCH_SIZE || "10",
  10,
);

/** Milliseconds between each queue polling cycle. */
export const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS || "15000",
  10,
);

/** Timeout for individual attachment downloads (ms). */
export const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = parseInt(
  process.env.ATTACHMENT_DOWNLOAD_TIMEOUT_MS || "20000",
  10,
);

/** Timeout for the main catalog PDF download (ms). */
export const CATALOG_DOWNLOAD_TIMEOUT_MS = parseInt(
  process.env.CATALOG_DOWNLOAD_TIMEOUT_MS || "45000",
  10,
);

// ─── External MSTC URLs ─────────────────────────────────────────────────────

export const MSTC_BASE_URL =
  process.env.MSTC_BASE_URL ||
  "https://www.mstcecommerce.com/auctionhome/mstc";

export const MSTC_CATALOG_PDF_ENDPOINT = `${MSTC_BASE_URL}/auction_detailed_report_pdf.jsp`;

export const MSTC_ATTACHMENT_ENDPOINT = `${MSTC_BASE_URL}/admin/upload/downAttachedFiles.jsp`;

// ─── Supabase Storage ────────────────────────────────────────────────────────

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "auction_documents";

// ─── Business Defaults ───────────────────────────────────────────────────────

export const DEFAULT_MSTC_OFFICER = {
  name: process.env.DEFAULT_MSTC_OFFICER_NAME || "S. K. Mukherjee",
  email:
    process.env.DEFAULT_MSTC_OFFICER_EMAIL || "smukherjee@mstcindia.co.in",
};

export const DEFAULT_CONTACT_EMAIL =
  process.env.DEFAULT_CONTACT_EMAIL || "see-catalog@mstc.co.in";

export const ADMIN_CHARGES =
  process.env.MSTC_ADMIN_CHARGES ||
  "₹11,800 (incl. GST) non-refundable service provider fees";

// ─── PDF Processing ─────────────────────────────────────────────────────────

/** Maximum number of embedded JPEG images to extract per PDF. */
export const MAX_EMBEDDED_IMAGES = parseInt(
  process.env.MAX_EMBEDDED_IMAGES || "5",
  10,
);

/** Minimum byte size for an extracted JPEG to be considered valid (not a thumbnail/icon). */
export const MIN_IMAGE_BYTE_SIZE = parseInt(
  process.env.MIN_IMAGE_BYTE_SIZE || "5000",
  10,
);

// ─── HTTP Headers ────────────────────────────────────────────────────────────

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
