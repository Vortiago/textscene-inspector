/** The order of one flat y-sort. */

import { isEqualApprox } from '../godot/math/math.js';
import type { YSortItem } from './ySortItems.js';

/**
 * `ItemYSort` (`renderer_canvas_cull.h:115-123`) for two sort ys: negative when `a` draws first, and
 * zero when they are equal within `is_equal_approx`, where the caller keeps the collection order.
 */
export function compareSortY(a: number, b: number): number {
  return isEqualApprox(a, b) ? 0 : a - b;
}

/**
 * Godot's order for one flat sort: the z bucket, then the sort y, and items whose y is equal
 * within `is_equal_approx` keep their collection order (`renderer_canvas_cull.h:115-123`).
 */
export function compareYSortItems(a: YSortItem, b: YSortItem): number {
  if (a.effectiveZ !== b.effectiveZ) return a.effectiveZ - b.effectiveZ;
  return compareSortY(a.sortY, b.sortY);
}
