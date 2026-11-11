/** The rasteriser's coverage of a span of pixel centres along one axis. */

/**
 * Lavapipe, the driver every Godot comparison renders on, snaps a vertex to 1/256 of a pixel
 * (llvmpipe's 8 subpixel bits) before it tests coverage.
 */
const SUBPIXEL_STEPS = 256;

function snapToSubpixel(windowX: number): number {
  return Math.round(windowX * SUBPIXEL_STEPS) / SUBPIXEL_STEPS;
}

/**
 * The whole pixels `[from, to)` covers with one sample per pixel centre, the ends snapped as
 * lavapipe snaps them. Pixel `n` is in iff `from <= n + 0.5 < to`, the top-left fill rule, so an
 * end exactly on a centre covers that pixel only from its left. `last < first` when no centre is
 * inside.
 *
 * @canonical The pixels a span covers by the top-left fill rule
 */
export function coveredPixelRange(from: number, to: number): { first: number; last: number } {
  return { first: Math.ceil(snapToSubpixel(from) - 0.5), last: Math.ceil(snapToSubpixel(to) - 0.5) - 1 };
}
