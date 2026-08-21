import crypto from "crypto";

/**
 * Computes a deterministic, lightweight fingerprint for a list of item IDs or strings.
 * Used to detect stalled pagination when clicking "Next" returns identical listings.
 */
export function computeListingsFingerprint(
  items: Array<string | number | null | undefined>
): string {
  if (!items || items.length === 0) return "";

  const validItems = items
    .map((item) => (item == null ? "" : String(item).trim()))
    .filter(Boolean);

  if (validItems.length === 0) return "";

  const serialized = validItems.sort().join("|");
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

/**
 * Verifies if the new page fingerprint is identical to the previous page fingerprint.
 * Returns true if pagination has stalled (fingerprints are identical and non-empty).
 */
export function isPaginationStalled(
  previousFingerprint: string,
  currentFingerprint: string
): boolean {
  if (!previousFingerprint || !currentFingerprint) return false;
  return previousFingerprint === currentFingerprint;
}
