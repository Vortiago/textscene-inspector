/** The order of one flat y-sort. */

import { isEqualApprox } from '../godot/math/math.js';

/**
 * `ItemYSort` (`renderer_canvas_cull.h:115-123`) for two sort ys: negative when `a` draws first, and
 * zero when they are equal within `is_equal_approx`, where the caller keeps the collection order.
 */
function compareSortY(a: number, b: number): number {
  return isEqualApprox(a, b) ? 0 : a - b;
}

/**
 * `items` in the order a sort draws them. `Array.prototype.sort` is stable, so equal ys keep
 * collection order, as `ysort_index` breaks a tie in Godot's unstable `SortArray`.
 */
export function inSortOrder<T>(items: readonly T[], sortYOf: (item: T) => number): T[] {
  return [...items].sort((a, b) => compareSortY(sortYOf(a), sortYOf(b)));
}
