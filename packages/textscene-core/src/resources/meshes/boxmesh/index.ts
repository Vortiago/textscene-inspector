/** BoxMesh resource slice — claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('boxmesh', ['BoxMesh']);

export { decodeBoxMesh } from './decode.js';
export type { BoxMeshProperties } from './types.js';
