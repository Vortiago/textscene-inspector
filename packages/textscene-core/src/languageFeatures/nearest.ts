/**
 * The nearest spelling in a candidate set, for a quick fix that repairs a typo. A
 * small Levenshtein distance, bounded so a wildly different name is left alone rather
 * than renamed to the least-bad class.
 */

/** The edit distance between two strings: insertions, deletions and substitutions. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * The candidate within `maxDistance` of `name`, nearest first, or undefined. Ties keep
 * the first in `candidates`, so the answer is stable.
 */
export function nearestName(
  name: string,
  candidates: readonly string[],
  maxDistance: number
): string | undefined {
  let best: string | undefined;
  let bestDistance = maxDistance + 1;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - name.length) > maxDistance) continue;
    const distance = editDistance(name, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
