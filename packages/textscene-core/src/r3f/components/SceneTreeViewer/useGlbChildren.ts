/**
 * Tree children for a `GLBSceneRoot` node: the GLB, loaded as the viewport
 * loads it, walked into synthetic `TscnNode`s. Null for a non-GLB row or while
 * the GLB loads. The walk clones each loaded GLB once.
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
  const result = useResource<THREE.Object3D>(glbPath ?? '', 'glb');

  return useMemo(() => {
    if (!glbPath || result.status !== 'loaded' || !result.value) return null;
    return glbSceneRootChildren(result.value);
  }, [glbPath, result.status, result.value]);
}
