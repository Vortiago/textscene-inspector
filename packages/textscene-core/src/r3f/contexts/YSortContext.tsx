/**
 * Threads the accumulated parent world-Y and effective Z through a y-sort
 * subtree, so each descendant computes its sort key.
 */
import { createContext, useContext } from 'react';

// No provider sets a non-default value, so a dispatcher starts its walk at 0/0.
// A walk accumulates as it merges a y_sort_enabled child's subtree, but not
// across walks: a y-sort node behind a non-y-sorted container mounts a fresh
// dispatcher at 0.
export interface YSortContextValue {
  parentWorldY: number;
  /**
   * The z the y-sort pass buckets on: `_collect_ysort_children` carries `abs_z`
   * down, and an item sorts only within its bucket. `EffectiveZContext` carries
   * the same `accumulateCanvasItemZ` value on the ordinary walk. Both feed the
   * draw-order bucket and the light cull's z window.
   */
  parentEffectiveZ: number;
}

// The walk starts at 0, not at the ambient `EffectiveZContext`, so a y-sort root
// under a z_index'd ancestor buckets from 0 while a plain CanvasItem there does
// not. Only the tile-group path, which reads this carrier, shows it.
const YSortContext = createContext<YSortContextValue>({
  parentWorldY: 0,
  parentEffectiveZ: 0,
});
YSortContext.displayName = 'YSortContext';

export function useYSortContext(): YSortContextValue {
  return useContext(YSortContext);
}
