/**
 * Fuzzy category mapper for MSTC auction categories.
 *
 * Loads category mappings from an external JSON data file and provides
 * multi-tier matching:
 *   1. Exact substring match (fast path).
 *   2. Normalized token overlap scoring.
 *   3. Levenshtein distance fuzzy matching (catches typos/variations).
 *
 * Fixes applied:
 * - Externalized from scraper.ts (was 300+ inline lines).
 * - Spelling variations (e.g. "compters" vs "computers") are now caught.
 * - Unknown categories are logged for manual review.
 */
import { createRequire } from "module";
import { logger } from "./logger.js";

const require = createRequire(import.meta.url);
const log = logger.child({ module: "categoryMapper" });

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryEntry {
  category: string;
  subcategory: string;
}

// ─── Levenshtein Distance ────────────────────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used for fuzzy matching when exact/token matching fails.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ─── Category Mapper ─────────────────────────────────────────────────────────

class CategoryMapper {
  private map: Record<string, CategoryEntry>;
  private sortedKeys: string[];

  constructor() {
    this.map = require("../data/categoryMap.json") as Record<
      string,
      CategoryEntry
    >;
    // Sort by key length descending so longer (more specific) keys match first
    this.sortedKeys = Object.keys(this.map).sort(
      (a, b) => b.length - a.length,
    );
  }

  /**
   * Map a raw category cell text to a structured { category, subcategory }.
   *
   * @param rawCellText - The raw text from the MSTC scraper results table.
   * @returns The matched category and subcategory.
   */
  mapCategory(rawCellText: string): CategoryEntry {
    const normalized = (rawCellText || "").toLowerCase().trim();

    // Handle pre-formatted "Category | Subcategory" strings
    if (normalized.includes(" | ")) {
      const parts = rawCellText.split(" | ");
      return { category: parts[0].trim(), subcategory: parts[1].trim() };
    }

    // ── Tier 1: Exact substring match ─────────────────────────────────────
    for (const key of this.sortedKeys) {
      if (normalized.includes(key)) {
        return this.map[key];
      }
    }

    // ── Tier 2: Token overlap scoring ─────────────────────────────────────
    const inputTokens = normalized
      .replace(/\s+/g, " ")
      .split(/,|\n|\/|&|and/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    for (const part of inputTokens) {
      for (const key of this.sortedKeys) {
        if (part.includes(key) || key.includes(part)) {
          return this.map[key];
        }
      }
    }

    // ── Tier 3: Levenshtein fuzzy matching ─────────────────────────────────
    // Only try for short-ish inputs (long compound strings aren't typos)
    if (normalized.length <= 40) {
      let bestKey = "";
      let bestDistance = Infinity;

      for (const key of this.sortedKeys) {
        // Only compare keys of similar length (±5 chars)
        if (Math.abs(key.length - normalized.length) > 5) continue;

        const dist = levenshtein(normalized, key);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestKey = key;
        }
      }

      // Accept fuzzy match if edit distance is within proportional threshold (max 25% of length, min 1)
      const maxAllowedDistance = Math.max(1, Math.floor(Math.max(normalized.length, bestKey.length) * 0.25));
      if (bestDistance <= maxAllowedDistance && bestKey) {
        log.info(
          {
            rawInput: rawCellText,
            matchedKey: bestKey,
            editDistance: bestDistance,
            maxAllowed: maxAllowedDistance,
          },
          "Fuzzy-matched category via Levenshtein distance",
        );
        return this.map[bestKey];
      }
    }

    // Also try fuzzy matching individual tokens
    for (const part of inputTokens) {
      if (part.length > 40) continue;

      let bestKey = "";
      let bestDistance = Infinity;

      for (const key of this.sortedKeys) {
        if (Math.abs(key.length - part.length) > 5) continue;
        const dist = levenshtein(part, key);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestKey = key;
        }
      }

      const maxAllowedDistance = Math.max(1, Math.floor(Math.max(part.length, bestKey.length) * 0.25));
      if (bestDistance <= maxAllowedDistance && bestKey) {
        log.info(
          {
            rawInput: rawCellText,
            tokenMatched: part,
            matchedKey: bestKey,
            editDistance: bestDistance,
            maxAllowed: maxAllowedDistance,
          },
          "Fuzzy-matched category token via Levenshtein distance",
        );
        return this.map[bestKey];
      }
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    log.warn(
      { rawInput: rawCellText },
      "Unmatched category — falling back to Miscellaneous. Consider adding this to categoryMap.json.",
    );
    return { category: "Miscellaneous", subcategory: rawCellText || "Others" };
  }
}

// Singleton instance
const mapper = new CategoryMapper();

/**
 * Map a raw MSTC category cell text to a structured { category, subcategory }.
 * This is the single public export consumed by scraper.ts.
 */
export function mapCategory(rawCellText: string): CategoryEntry {
  return mapper.mapCategory(rawCellText);
}
