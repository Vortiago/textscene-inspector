/** QuadMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('quadmesh', ['QuadMesh']);

export { decodeQuadMesh } from './decode.js';
export type { QuadMeshProperties } from './types.js';
