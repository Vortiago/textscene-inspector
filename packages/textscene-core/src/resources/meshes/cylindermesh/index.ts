/** CylinderMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('cylindermesh', ['CylinderMesh']);

export { decodeCylinderMesh } from './decode.js';
export type { CylinderMeshProperties } from './types.js';
