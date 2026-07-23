/**
 * YSortContext — threads accumulated parent world-Y and effective-Z through
 * the y-sort subtree so each descendant can compute its sort key.
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

/** Z-offset provider context — threads sort-based z down through a y-sort subtree. */
const YSortZContext = createContext<number | null>(null);
YSortZContext.displayName = 'YSortZContext';

export function YSortZProvider({ value, children }: { value: number | null; children: ReactNode }) {
  return <YSortZContext.Provider value={value}>{children}</YSortZContext.Provider>;
}

export function useYSortZContext(): number | null {
  return useContext(YSortZContext);
}

/** Y-sort collecting context — signals TileMapLayer not to render (parent hoists tiles). */
const YSortCollectingContext = createContext<boolean | null>(null);
YSortCollectingContext.displayName = 'YSortCollectingContext';

export function YSortCollectingProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <YSortCollectingContext.Provider value={value}>{children}</YSortCollectingContext.Provider>;
}

export function useYSortCollecting(): boolean | null {
  return useContext(YSortCollectingContext);
}
