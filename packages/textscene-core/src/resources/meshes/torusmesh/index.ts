/** TorusMesh resource slice — claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('torusmesh', ['TorusMesh']);

export { decodeTorusMesh } from './decode.js';
export type { TorusMeshProperties } from './types.js';
