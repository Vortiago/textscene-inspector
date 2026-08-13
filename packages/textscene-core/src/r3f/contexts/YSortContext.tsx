/**
 * YSortContext — threads accumulated parent world-Y and effective-Z through
 * the y-sort subtree so each descendant can compute its sort key.
 */
import { createContext, useContext } from 'react';

// NOTE: no provider currently sets non-default values, so a dispatcher always
// starts its walk at 0/0. Nesting INSIDE one walk does accumulate — the y-sort
// collection threads the derived value down as it merges a y_sort_enabled
// child's subtree into the flat sort. What is still missing is accumulation
// ACROSS walks: a y-sort node reached through a non-y-sorted container mounts a
// fresh dispatcher, which restarts at 0. This context is the seam that fix will
// write to.
//
// `parentEffectiveZ` is the z the y-sort pass BUCKETS on: `_collect_ysort_children`
// carries an `abs_z` down its own recursion, and items only ever sort against
// others in the same bucket. `EffectiveZContext` carries the same quantity for
// a node reached through the ordinary walk, where `<CanvasItem2D>` accumulates
// it. They are the same rule (`accumulateCanvasItemZ`) applied along two
// different paths, and both feed a canvas item's draw-order bucket as well as
// the light cull's z window.
//
// Where they still disagree: this walk starts at 0 rather than at the ambient
// `EffectiveZContext`, so a y-sort root reached through a z_index'd ancestor
// buckets its items from 0 while a plain CanvasItem under the same ancestor
// buckets from the accumulated value. Pre-existing, and only observable on the
// tile-group path, which reads this carrier directly.
export interface YSortContextValue {
  parentWorldY: number;
  parentEffectiveZ: number;
}

const YSortContext = createContext<YSortContextValue>({
  parentWorldY: 0,
  parentEffectiveZ: 0,
});
YSortContext.displayName = 'YSortContext';

export function useYSortContext(): YSortContextValue {
  return useContext(YSortContext);
}
