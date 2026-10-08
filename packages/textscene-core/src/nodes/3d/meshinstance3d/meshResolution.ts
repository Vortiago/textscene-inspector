/** The mesh a MeshInstance3D's `mesh` reference names, in the scene or in a `.tres`. */

import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResourceResolution, type ResourceResolution } from '../../../resources/useSubOrExtResource';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';

export interface MeshResolution extends ResourceResolution {
  /**
   * The `.tres` path of an external ArrayMesh, which the ArrayMesh processor decodes once for
   * every consumer. Null for any other mesh, and while the file loads.
   */
  arrayMeshPath: string | null;
}

export function useMeshResolution(meshRef: string | undefined, pools: SceneResources): MeshResolution {
  const resolution = useResourceResolution(meshRef, pools);
  const path = resolveExtResourcePath(meshRef, pools.externalResources);
  const arrayMeshPath = path && resolution.scoped?.resource.type === 'ArrayMesh' ? path : null;
  return { ...resolution, arrayMeshPath };
}
