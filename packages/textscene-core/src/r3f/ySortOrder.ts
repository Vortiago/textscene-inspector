/** The order of one flat y-sort. */

import { isEqualApprox } from '../godot/math/math.js';

/**
 * `ItemYSort` (`renderer_canvas_cull.h:115-123`) for two sort ys: negative when `a` draws first, and
 * zero when they are equal within `is_equal_approx`, where the caller keeps the collection order.
 */
export function compareSortY(a: number, b: number): number {
  return isEqualApprox(a, b) ? 0 : a - b;
}
