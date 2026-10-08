/** The box the rendering server holds for the mesh a `mesh` reference names, as a hook. */

import type { Aabb } from '../../../godot/aabb';
import type { TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { arrayMeshAabb } from '../../../resources/meshes/arraymesh/meshAabb';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { primitiveMeshAabb } from './primitiveMeshGeometry';
import { useContentMemo } from '../../../resources/useContentMemo';

/**
 * The box of the mesh `meshRef` names in `resources`, in mesh space: an ArrayMesh's or a
 * PrimitiveMesh's, in the scene or in a `.tres` once it loads. Null while it is unknown: no mesh
 * this previewer reads, or a `.tres` still loading. The same object while the mesh holds.
 */
export function useMeshAabb(meshRef: string | undefined, resources: SceneResources): Aabb | null {
  return useContentMemo(useSubOrExtResource(meshRef, resources)?.resource, meshAabb);
}

function meshAabb(resource: TscnInternalResource): Aabb | null {
  return resource.type === 'ArrayMesh' ? arrayMeshAabb(resource.data) : primitiveMeshAabb(resource);
}
