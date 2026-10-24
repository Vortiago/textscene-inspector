/** The box the rendering server holds for the mesh a `mesh` reference names, as a hook. */

import { useMemo } from 'react';

import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { parseOptionalAabb } from '../../../parser/valueParsers';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { projectPrimitiveMeshTexelSize } from '../../../parser/projectSettingsParser';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';
import { arrayMeshAabb } from '../../../resources/meshes/arraymesh/meshAabb';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { useResource } from '../../../resources/useResource';
import { useContentMemo } from '../../../resources/useContentMemo';
import { primitiveMeshAabb, surfaceMeshAabb } from '../../../r3f/meshes/primitiveMeshGeometry';
import { arrayMeshPath } from '../../../r3f/meshes/meshContent';
import { meshContentKey, meshKind } from '../../../resources/meshes/meshSource';
import { TEXT_MESH_TYPE, useTextMeshSurface } from '../../../resources/meshes/textmesh/useTextMeshSurface';
import { useResolvableMesh } from '../../../resources/meshes/useResolvableMesh';
import type { ResolvableResource, ScopedResource } from '../../../resources/scopedResource';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';

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
  const { mesh } = useResolvableMesh(path ? null : resolution.scoped);
  const own = useContentMemo(mesh, meshContentKey, meshAabb);
  const text = useTextMeshAabb(resolution.scoped);
  return path ? (file.value?.aabb ?? null) : (text ?? own);
}

/** The box of a TextMesh once its font has loaded. Null for any other mesh, and while its font is unknown. */
function useTextMeshAabb(scoped: ScopedResource | null): Aabb | null {
  const isTextMesh = scoped?.resource.type === TEXT_MESH_TYPE;
  const texelSize = projectPrimitiveMeshTexelSize(useProjectSettings().settings);
  const { surface } = useTextMeshSurface(isTextMesh ? scoped : null, texelSize);
  const customAabb = scoped?.resource.data['custom_aabb'];
  return useMemo(() => (surface ? surfaceMeshAabb(customAabb, surface) : null), [surface, customAabb]);
}

function meshAabb(mesh: ResolvableResource): Aabb | null {
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
