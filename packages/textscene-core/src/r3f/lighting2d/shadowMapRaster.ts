/**
 * Which bins of a one-row 2D shadow map an occluder edge covers. Godot extrudes each edge into a
 * quad far past the two rows (`renderer_canvas_render_rd.cpp:1343-1368`), so the edge's ends are
 * the quad's vertical sides, and a bin index is the window x of its pixel.
 */

/**
 * Lavapipe, the driver every Godot comparison renders on, snaps a vertex to 1/256 of a pixel
 * (llvmpipe's 8 subpixel bits) before it tests coverage.
 */
const SUBPIXEL_STEPS = 256;

function snapToSubpixel(windowX: number): number {
  return Math.round(windowX * SUBPIXEL_STEPS) / SUBPIXEL_STEPS;
}

/**
 * The first and last bin whose centre lies in `[left, right)`, the ends in window x. The top-left
 * rule covers a centre on a left side and not on a right side, so an end exactly on a bin centre
 * covers that bin only from its left. `last < first` when no centre is inside.
 */
export function coveredBins(left: number, right: number): readonly [first: number, last: number] {
  return [Math.ceil(snapToSubpixel(left) - 0.5), Math.ceil(snapToSubpixel(right) - 0.5) - 1];
}
