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

/**
 * The box in node space, `AABB()` for a node with no MultiMesh (`multimesh_instance_3d.cpp:100-102`),
 * or null while the MultiMesh or the mesh box it needs is unknown.
 */
export function useMultiMeshInstance3DAabb(node: TscnNode): Aabb | null {
  const scoped = useSubOrExtResource(node.rawProperties['multimesh'], useSceneResources());
  const multiMesh = useContentMemo(scoped, ownContentKey, readMultiMesh);
  const meshAabb = useMeshAabb(multiMesh?.mesh, scoped?.resources ?? NO_RESOURCES);
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
