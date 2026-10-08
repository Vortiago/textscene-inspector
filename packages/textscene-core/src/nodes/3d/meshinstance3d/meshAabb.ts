/** The box the rendering server holds for the mesh a `mesh` reference names, as a hook. */

import type { Aabb } from '../../../godot/aabb';
import type { TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { arrayMeshAabb } from '../../../resources/meshes/arraymesh/meshAabb';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { resolveSubResourceRef } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import { primitiveMeshAabb } from './primitiveMeshGeometry';
import { resolveExtArrayMeshPath } from './meshResolution';
import { useContentMemo } from '../../../resources/useContentMemo';

/**
 * The box of the mesh `meshRef` names in `resources`, in mesh space: a scene ArrayMesh's, a
 * PrimitiveMesh's, or an external `.tres` ArrayMesh's once it loads. Null while it is unknown: no
 * mesh this previewer reads, or a `.tres` still loading. The same object while the mesh holds.
 */
export function useMeshAabb(meshRef: string | undefined, resources: SceneResources): Aabb | null {
  const resource = resolveSubResourceRef(meshRef, resources.internalResources);
  const extPath = resolveExtArrayMeshPath(meshRef, resources.externalResources);
  const external = useResource<ArrayMeshResource>(extPath ?? '', 'arraymesh');
  const sceneAabb = useContentMemo(resource, sceneMeshAabb);
  if (extPath) return external.value?.aabb ?? null;
  return sceneAabb;
}

function sceneMeshAabb(resource: TscnInternalResource): Aabb | null {
  return resource.type === 'ArrayMesh' ? arrayMeshAabb(resource.data) : primitiveMeshAabb(resource);
}
