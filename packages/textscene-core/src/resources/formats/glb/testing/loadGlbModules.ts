/** Loads the lazily imported glTF modules for a test that clones before it builds a mesh. */

import { createGLBMesh } from '../glbProcessing';
import { NO_SIDECAR } from './noSidecar';
import { triangleGlb } from './triangleGlb';

/** Builds one mesh, which loads the modules `cloneWithMaterials` needs, as production does. */
export async function loadGlbModules(): Promise<void> {
  await createGLBMesh(triangleGlb(), NO_SIDECAR);
}
