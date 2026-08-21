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
): Promise<string> {
  assertSupabaseCredentials();

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

