/** SphereMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('spheremesh', ['SphereMesh']);

export { decodeSphereMesh } from './decode.js';
export type { SphereMeshProperties } from './types.js';
