/**
 * Tree children for a `GLBSceneRoot` node: load the GLB via the same
 * useResource('GLBMesh') flow the viewport uses, then walk its THREE.Object3D
 * into synthetic `TscnNode`s. Mirrors `useSubSceneChildren` — returns null for
 * non-GLB rows or while the GLB is still loading, and the hook re-renders the
 * tree when the GLB arrives. (The clone this incurs is one-time per loaded GLB;
 * a shared structural cache could dedupe it against the viewport clone later.)
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import { useResource } from '../../../resources/useResource.js';
import { GLB_SCENE_ROOT_TYPE } from '../../internal/glb-scene-root/Component.js';
import { glbSceneRootChildren } from '../../internal/glb-scene-root/glbHierarchy.js';

export function useGlbChildren(node: TscnNode): readonly TscnNode[] | null {
  const glbPath =
    node.type === GLB_SCENE_ROOT_TYPE
      ? ((node.properties as Record<string, unknown>).glbPath as string | undefined)
      : undefined;
  const result = useResource<THREE.Object3D>(glbPath ?? '', 'GLBMesh');

  return useMemo(() => {
    if (!glbPath || result.status !== 'loaded' || !result.value) return null;
    return glbSceneRootChildren(result.value);
  }, [glbPath, result.status, result.value]);
}
