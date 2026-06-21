/**
 * Calculates the Levenshtein Distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one word into the other.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Returns a similarity score between 0 and 1.
 * 1 means identical, 0 means completely different.
 */
export function getSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return (maxLength - distance) / maxLength;
}

/**
 * Finds the best matching commodity keyword from a list of options.
 * If the best match has a similarity score >= threshold, returns the match, otherwise returns null.
 */
export function findBestMatch(word: string, candidates: string[], threshold: number = 0.8): string | null {
  if (!word || candidates.length === 0) return null;
  
  let bestMatch = null;
  let highestScore = 0;
  
  for (const candidate of candidates) {
    const score = getSimilarity(word, candidate);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }
  
  if (highestScore >= threshold) {
    return bestMatch;
  }
  
  return null;
}
