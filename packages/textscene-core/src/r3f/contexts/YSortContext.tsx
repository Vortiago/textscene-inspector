/**
 * YSortContext — threads accumulated parent world-Y and effective-Z through
 * the y-sort subtree so each descendant can compute its sort key.
 *
 * `parentWorldY` — accumulated world-space Y of the current parent.
 * `parentEffectiveZ` — accumulated absolute Z of the current parent.
 * `insideYSort` — whether we are inside an `y_sort_enabled` subtree.
 */
import { createContext, useContext, type ReactNode } from 'react';

export interface YSortContextValue {
  parentWorldY: number;
  parentEffectiveZ: number;
  insideYSort: boolean;
  depth: number;
}

const YSortContext = createContext<YSortContextValue>({
  parentWorldY: 0,
  parentEffectiveZ: 0,
  insideYSort: false,
  depth: 0,
});
YSortContext.displayName = 'YSortContext';

export function YSortProvider({ value, children }: { value: YSortContextValue; children: ReactNode }) {
  return <YSortContext.Provider value={value}>{children}</YSortContext.Provider>;
}

export function useYSortContext(): YSortContextValue {
  return useContext(YSortContext);
}
