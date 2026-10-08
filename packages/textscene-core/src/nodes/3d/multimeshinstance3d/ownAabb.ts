/**
 * The box a MultiMeshInstance3D gives its instance: its MultiMesh's (`renderer_scene_cull.cpp:1996`),
 * built from the MultiMesh's mesh and instance transforms as the rendering server builds it.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../parser/types';
import type { Aabb } from '../../../godot/aabb';
import { warn } from '../../../logger';
import { useScopedResource } from '../../../resources/useScopedResource';
import { decodeMultiMesh, multiMeshAabb, type MultiMeshData } from '../../../resources/meshes/multimesh';
import { useMeshAabb } from '../meshinstance3d/meshAabb';
import { resourceContentKey } from '../../../resources/resourceContentKey';

/** The box in node space, or null while the MultiMesh or the mesh box it needs is unknown. */
export function useMultiMeshInstance3DAabb(node: TscnNode): Aabb | null {
  const scoped = useScopedResource(node.rawProperties['multimesh']);
  const key = scoped ? resourceContentKey(scoped.resource) : null;
  const multiMesh = useMemo(
    () => (scoped ? readMultiMesh(scoped.resource.type, scoped.resource.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of the resource.
    [key]
  );
  const meshAabb = useMeshAabb(multiMesh?.mesh, scoped?.resources ?? NO_RESOURCES);
  return useMemo(() => multiMesh && multiMeshAabb(multiMesh, meshAabb), [multiMesh, meshAabb]);
}

const NO_RESOURCES = Object.freeze({ internalResources: [], externalResources: [] });

/** The MultiMesh a bag holds, or null for another type or a packed array this cannot read. */
function readMultiMesh(type: string, properties: Record<string, string>): MultiMeshData | null {
  if (type !== 'MultiMesh') return null;
  try {
    return decodeMultiMesh(properties);
  } catch (error) {
    warn(
      `[MultiMeshInstance3D] MultiMesh unreadable: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
