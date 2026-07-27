/**
 * YSortContext — threads accumulated parent world-Y and effective-Z through
 * the y-sort subtree so each descendant can compute its sort key.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import { YSORT_FINE_RANGE } from '../node2dTransform';

// NOTE: no provider currently sets non-default values, so a dispatcher always
// starts its walk at 0/0. Nesting INSIDE one walk does accumulate — the y-sort
// collection threads the derived value down as it merges a y_sort_enabled
// child's subtree into the flat sort. What is still missing is accumulation
// ACROSS walks: a y-sort node reached through a non-y-sorted container mounts a
// fresh dispatcher, which restarts at 0. This context is the seam that fix will
// write to.
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

/** Z-offset provider context — threads sort-based z down through a y-sort subtree. */
const YSortZContext = createContext<number | null>(null);
YSortZContext.displayName = 'YSortZContext';

export function YSortZProvider({ value, children }: { value: number | null; children: ReactNode }) {
  return <YSortZContext.Provider value={value}>{children}</YSortZContext.Provider>;
}

export function useYSortZContext(): number | null {
  return useContext(YSortZContext);
}

/**
 * YSortSlot — the z sub-range a subtree may occupy within its z-index band.
 * A non-y-sort container that HAS a y-sort descendant divides its slot into a
 * tree-order sub-slot per child, so sibling y-sort subtrees (e.g. Floor vs Walls
 * under the non-y-sorted dungeon root) get DISJOINT, tree-ordered z-bands instead
 * of both landing in the same (0, FINE_RANGE) band and interleaving. A Node2D's
 * group sits at `canvasItemZ + base`; a y-sort dispatcher scales its ranks to
 * `width`. Default = the full fine range (top level / no y-sort siblings), which
 * reproduces the pre-slot behaviour for a lone subtree.
 */
export interface YSortSlot {
  base: number;
  width: number;
}
const YSortSlotContext = createContext<YSortSlot>({ base: 0, width: YSORT_FINE_RANGE });
YSortSlotContext.displayName = 'YSortSlotContext';

export function YSortSlotProvider({ value, children }: { value: YSortSlot; children: ReactNode }) {
  return <YSortSlotContext.Provider value={value}>{children}</YSortSlotContext.Provider>;
}

export function useYSortSlot(): YSortSlot {
  return useContext(YSortSlotContext);
}

/** True if any node in the subtree (excluding `node` itself) is y_sort_enabled. */
export function hasYSortDescendant(node: TscnNode): boolean {
  for (const child of node.children) {
    if ((child.properties as { y_sort_enabled?: boolean }).y_sort_enabled === true) return true;
    if (hasYSortDescendant(child)) return true;
  }
  return false;
}
