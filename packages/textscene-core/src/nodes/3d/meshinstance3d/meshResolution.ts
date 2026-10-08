/** The mesh a MeshInstance3D's `mesh` reference names, in the scene or in a `.tres`. */

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
  const { tresPath, scoped } = resolution;
  const arrayMeshPath = tresPath && scoped?.resource.type === 'ArrayMesh' ? tresPath : null;
  return { ...resolution, arrayMeshPath };
}
