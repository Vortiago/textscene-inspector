/** CapsuleMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('capsulemesh', ['CapsuleMesh']);

export { decodeCapsuleMesh } from './decode.js';
export type { CapsuleMeshProperties } from './types.js';
