/**
 * Tree children for a `GLBSceneRoot` node: the GLB, loaded as the viewport
 * loads it, walked into synthetic `TscnNode`s. Null for a non-GLB row or while
 * the GLB loads. The walk clones each loaded GLB once. The typed nodes an instancing scene adds
 * inside the GLB arrive as the row's own children, and each lands under the GLB row it addresses.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types.js';
import { useResource } from '../../../resources/useResource.js';
import { glbPathOf } from '../../../resources/glbSceneRoot.js';
import { glbSceneRootChildren } from '../../internal/glb-scene-root/glbHierarchy.js';

export function useGlbChildren(node: TscnNode): readonly TscnNode[] | null {
  const glbPath = glbPathOf(node);
  const result = useResource<THREE.Object3D>(glbPath ?? '', 'glb');

  return useMemo(() => {
    if (!glbPath || result.status !== 'loaded' || !result.value) return null;
    return glbSceneRootChildren(result.value, node.children);
  }, [glbPath, result.status, result.value, node.children]);
}
