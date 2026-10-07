/** PrismMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('prismmesh', ['PrismMesh']);

export { decodePrismMesh } from './decode.js';
export type { PrismMeshProperties } from './types.js';
