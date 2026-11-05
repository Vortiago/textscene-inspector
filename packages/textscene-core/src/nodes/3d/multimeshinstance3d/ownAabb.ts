/**
 * The box a MultiMeshInstance3D gives its instance: its MultiMesh's (`renderer_scene_cull.cpp:1996`),
 * built from the MultiMesh's mesh and instance transforms as the rendering server builds it.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { multiMeshAabb } from '../../../resources/meshes/multimesh';
import { useReferencedMultiMesh } from '../../../resources/meshes/multimesh/useMultiMeshData';
import { useMeshAabb } from '../meshinstance3d/meshAabb';

/**
 * The box in node space, `AABB()` for a node with no MultiMesh (`multimesh_instance_3d.cpp:100-102`),
 * or null while the MultiMesh or the mesh box it needs is unknown.
 */
export function useMultiMeshInstance3DAabb(node: TscnNode): Aabb | null {
  const { multiMesh, resources } = useReferencedMultiMesh(node.rawProperties['multimesh']);
  const meshAabb = useMeshAabb(multiMesh?.mesh, resources);
  const hasMultiMesh = node.rawProperties['multimesh'] !== undefined;
  return useMemo(() => {
    if (multiMesh) return multiMeshAabb(multiMesh, meshAabb);
    return hasMultiMesh ? null : EMPTY_AABB;
  }, [multiMesh, meshAabb, hasMultiMesh]);
}
