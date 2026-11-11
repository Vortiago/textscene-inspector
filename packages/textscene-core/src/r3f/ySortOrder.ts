/** The order of one flat y-sort. */

import { isEqualApprox } from '../godot/math/math.js';
import type { YSortItem } from './ySortItems.js';

/**
 * Godot's order for one flat sort: the z bucket, then the sort y, and items whose y is equal
 * within `is_equal_approx` keep their collection order (`renderer_canvas_cull.h:115-123`).
 */
export function compareYSortItems(a: YSortItem, b: YSortItem): number {
  if (a.effectiveZ !== b.effectiveZ) return a.effectiveZ - b.effectiveZ;
  return isEqualApprox(a.sortY, b.sortY) ? 0 : a.sortY - b.sortY;
}
