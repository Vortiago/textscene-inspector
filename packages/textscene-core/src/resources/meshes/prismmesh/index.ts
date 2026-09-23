/** PrismMesh resource slice: claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('prismmesh', ['PrismMesh']);

export { decodePrismMesh } from './decode.js';
export type { PrismMeshProperties } from './types.js';
