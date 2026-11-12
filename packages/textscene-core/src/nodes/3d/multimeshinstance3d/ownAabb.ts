/**
 * The box a MultiMeshInstance3D gives its instance: its MultiMesh's (`renderer_scene_cull.cpp:1996`),
 * built from the MultiMesh's mesh and instance transforms as the rendering server builds it.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { warn } from '../../../logger';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { NO_RESOURCES, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { decodeMultiMesh, multiMeshAabb, type MultiMeshData } from '../../../resources/meshes/multimesh';
import { useMeshAabb } from '../meshinstance3d/meshAabb';
import { resourceContentKey } from '../../../resources/resourceContentKey';
import type { ScopedResource } from '../../../resources/scopedResource';
import { useContentMemo } from '../../../resources/useContentMemo';

/** The MultiMesh a node holds, and the resources its mesh reference reads. */
export interface NodeMultiMesh {
  /** Null while the reference is unresolved, or when it names a MultiMesh this cannot read. */
  multiMesh: MultiMeshData | null;
  resources: ScopedResource['resources'];
}

/** The node's MultiMesh, read from a SubResource or a file. */
export function useNodeMultiMesh(node: TscnNode): NodeMultiMesh {
  const scoped = useSubOrExtResource(node.rawProperties['multimesh'], useSceneResources());
  const multiMesh = useContentMemo(scoped, ownContentKey, readMultiMesh);
  return { multiMesh, resources: scoped?.resources ?? NO_RESOURCES };
}

/**
 * The box in node space, `AABB()` for a node with no MultiMesh (`multimesh_instance_3d.cpp:100-102`),
 * or null while the MultiMesh or the mesh box it needs is unknown.
 */
export function useMultiMeshInstance3DAabb(node: TscnNode): Aabb | null {
  const { multiMesh, resources } = useNodeMultiMesh(node);
  return useMultiMeshAabb(node, multiMesh, resources);
}

/** `useMultiMeshInstance3DAabb` over a MultiMesh a caller has read already. */
export function useMultiMeshAabb(
  node: TscnNode,
  multiMesh: MultiMeshData | null,
  resources: NodeMultiMesh['resources']
): Aabb | null {
  const meshAabb = useMeshAabb(multiMesh?.mesh, resources);
  const hasMultiMesh = node.rawProperties['multimesh'] !== undefined;
  return useMemo(() => {
    if (multiMesh) return multiMeshAabb(multiMesh, meshAabb);
    return hasMultiMesh ? null : EMPTY_AABB;
  }, [multiMesh, meshAabb, hasMultiMesh]);
}

/** A MultiMesh reads no file, so its own content is the whole key. */
function ownContentKey({ resource }: ScopedResource): string {
  return resourceContentKey(resource);
}

/** The MultiMesh a bag holds, or null for another type or a packed array this cannot read. */
function readMultiMesh({ resource }: ScopedResource): MultiMeshData | null {
  if (resource.type !== 'MultiMesh') return null;
  try {
    return decodeMultiMesh(resource.data);
  } catch (error) {
    warn(
      `[MultiMeshInstance3D] MultiMesh unreadable: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
