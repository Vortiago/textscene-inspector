/** The box the rendering server holds for the mesh a `mesh` reference names, as a hook. */

import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { parseOptionalAabb } from '../../../parser/valueParsers';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { arrayMeshAabb } from '../../../resources/meshes/arraymesh/meshAabb';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { useResource } from '../../../resources/useResource';
import { useContentMemo } from '../../../resources/useContentMemo';
import { primitiveMeshAabb } from '../../../r3f/meshes/primitiveMeshGeometry';
import { arrayMeshPath } from '../../../r3f/meshes/meshContent';
import { meshContentKey, meshKind } from '../../../resources/meshes/meshSource';
import { useResourceResolution, type ScopedResource } from '../../../resources/useSubOrExtResource';

/**
 * The box of the mesh `meshRef` names in `resources`, in mesh space, in the scene or in a `.tres`
 * once it loads. Null while it is unknown: no mesh this previewer reads, or a `.tres` still
 * loading. The same object while the mesh holds.
 */
export function useMeshAabb(meshRef: string | undefined, resources: SceneResources): Aabb | null {
  const resolution = useResourceResolution(meshRef, resources);
  const path = arrayMeshPath(resolution);
  // The ArrayMesh processor bounds a `.tres` ArrayMesh once for every consumer.
  const file = useResource<ArrayMeshResource>(path ?? '', 'arraymesh');
  const own = useContentMemo(path ? null : resolution.scoped, meshContentKey, meshAabb);
  return path ? (file.value?.aabb ?? null) : own;
}

function meshAabb(mesh: ScopedResource): Aabb | null {
  const { resource } = mesh;
  switch (meshKind(resource.type)) {
    case 'arrayMesh':
      return arrayMeshAabb(resource.data);
    case 'primitive':
      return primitiveMeshAabb(mesh);
    case 'surfaceless':
      // A PlaceholderMesh holds its own `aabb` (`mesh.h:430`).
      return parseOptionalAabb(resource.data['aabb'], `${resource.type} "${resource.id}" aabb`) ?? EMPTY_AABB;
    default:
      return null;
  }
}
