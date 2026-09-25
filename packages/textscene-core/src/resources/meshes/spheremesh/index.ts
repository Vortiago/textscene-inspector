/** SphereMesh resource slice: claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('spheremesh', ['SphereMesh']);

export { decodeSphereMesh } from './decode.js';
export type { SphereMeshProperties } from './types.js';
