/**
 * The box a MultiMeshInstance3D gives its instance: its MultiMesh's (`renderer_scene_cull.cpp:1996`),
 * built from the MultiMesh's mesh and instance transforms as the rendering server builds it.
 */

import { useMemo } from 'react';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { Aabb } from '../../../godot/aabb';
import { warn } from '../../../logger';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { NO_RESOURCES, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { decodeMultiMesh, multiMeshAabb, type MultiMeshData } from '../../../resources/meshes/multimesh';
import { useMeshAabb } from '../meshinstance3d/meshAabb';
import { useContentMemo } from '../../../resources/useContentMemo';

/** The box in node space, or null while the MultiMesh or the mesh box it needs is unknown. */
export function useMultiMeshInstance3DAabb(node: TscnNode): Aabb | null {
  const scoped = useSubOrExtResource(node.rawProperties['multimesh'], useSceneResources());
  const multiMesh = useContentMemo(scoped?.resource, readMultiMesh);
  const meshAabb = useMeshAabb(multiMesh?.mesh, scoped?.resources ?? NO_RESOURCES);
  return useMemo(() => multiMesh && multiMeshAabb(multiMesh, meshAabb), [multiMesh, meshAabb]);
}

/** The MultiMesh a bag holds, or null for another type or a packed array this cannot read. */
function readMultiMesh({ type, data }: TscnInternalResource): MultiMeshData | null {
  if (type !== 'MultiMesh') return null;
  try {
    return decodeMultiMesh(data);
  } catch (error) {
    warn(
      `[MultiMeshInstance3D] MultiMesh unreadable: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
