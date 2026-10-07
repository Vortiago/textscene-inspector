/** TorusMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('torusmesh', ['TorusMesh']);

export { decodeTorusMesh } from './decode.js';
export type { TorusMeshProperties } from './types.js';
