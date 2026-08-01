/** QuadMesh resource slice — claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('quadmesh', ['QuadMesh']);

export { decodeQuadMesh } from './decode.js';
export type { QuadMeshProperties } from './types.js';
