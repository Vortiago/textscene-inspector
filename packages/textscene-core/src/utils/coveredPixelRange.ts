/** The rasteriser's coverage of a span of pixel centres along one axis. */

/**
 * The whole pixels `[from, to)` covers with one sample per pixel centre: pixel `n` is in iff
 * `from <= n + 0.5 < to`, the top-left fill rule. `last < first` when no centre is inside.
 *
 * @canonical The pixels a span covers by the top-left fill rule
 */
export function coveredPixelRange(from: number, to: number): { first: number; last: number } {
  return { first: Math.ceil(from - 0.5), last: Math.ceil(to - 0.5) - 1 };
}
