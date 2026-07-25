/**
 * Fuzzy category mapper for MSTC auction categories.
 */
import { createRequire } from "module";
import { logger } from "./logger.js";

const require = createRequire(import.meta.url);
const log = logger.child({ module: "categoryMapper" });

interface CategoryEntry {
  category: string;
  subcategory: string;
}

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

class CategoryMapper {
  private map: Record<string, CategoryEntry>;
  private sortedKeys: string[];

  constructor() {
    this.map = require("../../data/categoryMap.json") as Record<
      string,
      CategoryEntry
    >;
    this.sortedKeys = Object.keys(this.map).sort(
      (a, b) => b.length - a.length,
    );
  }

  mapCategory(rawCellText: string): CategoryEntry {
    const normalized = (rawCellText || "").toLowerCase().trim();

    if (normalized.includes(" | ")) {
      const parts = rawCellText.split(" | ");
      return { category: parts[0].trim(), subcategory: parts[1].trim() };
    }

    for (const key of this.sortedKeys) {
      if (normalized.includes(key)) {
        return this.map[key];
      }
    }

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

    if (normalized.length <= 40) {
      let bestKey = "";
      let bestDistance = Infinity;

      for (const key of this.sortedKeys) {
        if (Math.abs(key.length - normalized.length) > 5) continue;

        const dist = levenshtein(normalized, key);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestKey = key;
        }
      }

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

    log.warn(
      { rawInput: rawCellText },
      "Unmatched category — falling back to Miscellaneous. Consider adding this to categoryMap.json.",
    );
    return { category: "Miscellaneous", subcategory: rawCellText || "Others" };
  }
}

const mapper = new CategoryMapper();

export function mapCategory(rawCellText: string): CategoryEntry {
  return mapper.mapCategory(rawCellText);
}
