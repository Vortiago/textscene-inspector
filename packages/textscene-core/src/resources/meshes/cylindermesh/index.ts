/** CylinderMesh resource slice: claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('cylindermesh', ['CylinderMesh']);

export { decodeCylinderMesh } from './decode.js';
export type { CylinderMeshProperties } from './types.js';
