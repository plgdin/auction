/**
 * Reusable Supabase storage helpers.
 *
 * Consolidates the repeated upload-then-get-public-url pattern into a
 * single function, eliminating duplication across the worker pipeline.
 */
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STORAGE_BUCKET,
} from "../config.js";
import { logger } from "./logger.js";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error(
    {},
    "CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Exiting.",
  );
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Upload a buffer to Supabase storage and return its public URL.
 *
 * @param storagePath  - Path within the bucket (e.g. `mstc-catalogs/abc.pdf`).
 * @param buffer       - File contents.
 * @param contentType  - MIME type (e.g. `application/pdf`, `image/jpeg`).
 * @returns The public URL of the uploaded file.
 * @throws If the upload fails.
 */
export async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    logger.error(
      { storagePath, errorMessage: error.message },
      "Storage upload failed",
    );
    throw error;
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
