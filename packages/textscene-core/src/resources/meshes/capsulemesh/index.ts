/** CapsuleMesh resource slice: claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('capsulemesh', ['CapsuleMesh']);

export { decodeCapsuleMesh } from './decode.js';
export type { CapsuleMeshProperties } from './types.js';
