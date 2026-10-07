/** BoxMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('boxmesh', ['BoxMesh']);

export { decodeBoxMesh } from './decode.js';
export type { BoxMeshProperties } from './types.js';
