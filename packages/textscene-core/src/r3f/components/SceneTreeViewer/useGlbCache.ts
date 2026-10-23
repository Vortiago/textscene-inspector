/**
 * The loaded GLB a tree row descends into, loaded as the viewport loads it, as the cache
 * `liveChildGroups` reads: a `GLBSceneRoot` row's own GLB, or the GLB an instance row's sub-scene is
 * made of. Undefined for no path, and while the GLB loads, so the row keeps its children inline
 * until it arrives.
 */
import { useMemo } from 'react';
import { useGlb } from '../../../resources/useGlb.js';
import { singlePathCache, type CachedGlbSource } from '../../liveSceneTree.js';

export function useGlbCache(glbPath: string | undefined): CachedGlbSource | undefined {
  const result = useGlb(glbPath);

  return useMemo(() => {
    if (!glbPath || result.status !== 'loaded' || !result.value) return undefined;
    return singlePathCache(glbPath, result.value);
  }, [glbPath, result.status, result.value]);
}
