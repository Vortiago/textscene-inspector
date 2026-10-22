/**
 * The loaded GLB a sub-scene is made of, when its only root is a `GLBSceneRoot` (an instanced
 * `.glb`), as the cache `liveChildGroups` places a typed child with. Undefined for any other
 * sub-scene, and while the GLB loads, so the row keeps its children inline until it arrives.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import { useResource } from '../../../resources/useResource.js';
import { loneGlbPath } from '../../../resources/glbSceneRoot.js';
import type { CachedGlbSource } from '../../liveSceneTree.js';
import type { SubSceneChildren } from './useSubSceneChildren.js';

export function useInstancedGlbCache(subScene: SubSceneChildren | null): CachedGlbSource | undefined {
  const glbPath = subScene && loneGlbPath(subScene.nodes);
  const result = useResource<THREE.Object3D>(glbPath ?? '', 'glb');

  return useMemo(() => {
    if (!glbPath || result.status !== 'loaded' || !result.value) return undefined;
    const object = result.value;
    return { getCached: (path) => (path === glbPath ? object : undefined) };
  }, [glbPath, result.status, result.value]);
}
