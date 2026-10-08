/** The box the rendering server holds for the mesh a `mesh` reference names, as a hook. */

import type { Aabb } from '../../../godot/aabb';
import type { TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { arrayMeshAabb } from '../../../resources/meshes/arraymesh/meshAabb';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { useResource } from '../../../resources/useResource';
import { useContentMemo } from '../../../resources/useContentMemo';
import { primitiveMeshAabb } from './primitiveMeshGeometry';
import { useMeshResolution } from './meshResolution';

/**
 * The box of the mesh `meshRef` names in `resources`, in mesh space: an ArrayMesh's or a
 * PrimitiveMesh's, in the scene or in a `.tres` once it loads. Null while it is unknown: no mesh
 * this previewer reads, or a `.tres` still loading. The same object while the mesh holds.
 */
export function useMeshAabb(meshRef: string | undefined, resources: SceneResources): Aabb | null {
  const mesh = useMeshResolution(meshRef, resources);
  // The ArrayMesh processor bounds a `.tres` ArrayMesh once for every consumer.
  const file = useResource<ArrayMeshResource>(mesh.arrayMeshPath ?? '', 'arraymesh');
  const own = useContentMemo(mesh.arrayMeshPath ? null : mesh.scoped?.resource, meshAabb);
  return mesh.arrayMeshPath ? (file.value?.aabb ?? null) : own;
}

function meshAabb(resource: TscnInternalResource): Aabb | null {
  return resource.type === 'ArrayMesh' ? arrayMeshAabb(resource.data) : primitiveMeshAabb(resource);
}
