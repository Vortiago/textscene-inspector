/**
 * The box a MultiMeshInstance3D gives its instance: its MultiMesh's (`renderer_scene_cull.cpp:1996`),
 * built from the MultiMesh's mesh and instance transforms as the rendering server builds it.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { useNodeResource } from '../../../resources/reading';
import { NO_RESOURCES } from '../../../r3f/SceneResourcesContext';
import { multiMeshAabb, MULTI_MESH, type HeldMultiMesh } from '../../../resources/meshes/multimesh';
import { useMeshAabb } from '../meshinstance3d/meshAabb';
import { useResourceResolution, type ResourceResolution } from '../../../resources/useSubOrExtResource';

/** What a MultiMeshInstance3D reads of its MultiMesh. */
export interface NodeMultiMesh {
  /** Null while the reference is unresolved, or when it names a MultiMesh this cannot read. */
  multiMesh: HeldMultiMesh | null;
  /** The MultiMesh's `mesh` slot, resolved in the tables of the file that wrote the MultiMesh. */
  meshResolution: ResourceResolution;
  /**
   * The box in node space, `AABB()` for a node with no MultiMesh (`multimesh_instance_3d.cpp:100-102`),
   * or null while the MultiMesh or the mesh box it needs is unknown.
   */
  ownAabb: Aabb | null;
}

/**
 * The node's MultiMesh, read from a SubResource or a file, and the box it gives the instance.
 * MultiMeshInstance2D reads its MultiMesh through here too and takes no box.
 */
export function useMultiMeshInstance3D(node: TscnNode): NodeMultiMesh {
  const multiMeshRef = node.rawProperties['multimesh'];
  const { value: multiMesh } = useNodeResource(multiMeshRef, MULTI_MESH);
  const { ref: meshRef, resources } = multiMesh?.meshReference ?? { ref: undefined, resources: NO_RESOURCES };
  const meshResolution = useResourceResolution(meshRef, resources);
  const meshAabb = useMeshAabb(meshRef, resources);
  const hasMultiMesh = multiMeshRef !== undefined;
  const ownAabb = useMemo(() => {
    if (multiMesh) return multiMeshAabb(multiMesh, meshAabb);
    return hasMultiMesh ? null : EMPTY_AABB;
  }, [multiMesh, meshAabb, hasMultiMesh]);
  return { multiMesh, meshResolution, ownAabb };
}
