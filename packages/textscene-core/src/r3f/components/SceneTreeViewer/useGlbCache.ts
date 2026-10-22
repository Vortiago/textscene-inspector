/**
 * The loaded GLB a tree row descends into, loaded as the viewport loads it, as the cache
 * `liveChildGroups` reads: a `GLBSceneRoot` row's own GLB, or the GLB an instance row's sub-scene is
 * made of. Undefined for no path, and while the GLB loads, so the row keeps its children inline
 * until it arrives.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import { useResource } from '../../../resources/useResource.js';
import type { CachedGlbSource } from '../../liveSceneTree.js';

export function useGlbCache(glbPath: string | undefined): CachedGlbSource | undefined {
  const result = useResource<THREE.Object3D>(glbPath ?? '', 'glb');

  return useMemo(() => {
    if (!glbPath || result.status !== 'loaded' || !result.value) return undefined;
    const object = result.value;
    return { getCached: (path) => (path === glbPath ? object : undefined) };
  }, [glbPath, result.status, result.value]);
}
