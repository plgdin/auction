/**
 * Reusable Supabase storage helpers.
 */
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STORAGE_BUCKET,
} from "../../config.js";
import { logger } from "./logger.js";

const defaultUrl = SUPABASE_URL || "https://placeholder-project.supabase.co";
const defaultKey = SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

export const supabase = createClient(defaultUrl, defaultKey, {
  auth: { persistSession: false },
});

export function assertSupabaseCredentials(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error(
      {},
      "CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Ensure environment variables are configured.",
    );
    throw new Error("Supabase credentials not configured in environment");
  }
}

/**
 * Checks if a file exists in Supabase Storage using lightweight directory metadata listing
 * without downloading the actual file content (zero byte bandwidth overhead).
 */
export async function checkFileExistsInStorage(
  storagePath: string,
  bucketName: string = STORAGE_BUCKET,
): Promise<{ exists: boolean; publicUrl?: string }> {
  try {
    const parts = storagePath.split("/");
    const fileName = parts.pop() || "";
    const folderPath = parts.join("/");

    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath, { search: fileName, limit: 1 });

    if (error || !Array.isArray(files)) {
      return { exists: false };
    }

    const matched = files.some((f) => f.name === fileName);
    if (matched) {
      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);
      return { exists: true, publicUrl: data.publicUrl };
    }

    return { exists: false };
  } catch {
    return { exists: false };
  }
}

export async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
  maxAttempts: number = 3,
): Promise<string> {
  assertSupabaseCredentials();

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      return data.publicUrl;
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err.message?.includes("timed out") ||
        err.message?.includes("connection") ||
        err.message?.includes("504") ||
        err.message?.includes("503") ||
        err.message?.includes("502") ||
        err.message?.includes("network");

      logger.warn(
        { storagePath, attempt, maxAttempts, errorMessage: err.message, isTransient },
        "Storage upload attempt failed"
      );

      if (attempt < maxAttempts) {
        const delayMs = 1500 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error(
    { storagePath, errorMessage: lastError?.message },
    "Storage upload failed after all retry attempts"
  );
  throw lastError || new Error("Failed to upload file to storage");
}

