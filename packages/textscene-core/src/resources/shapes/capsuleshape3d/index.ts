/** CapsuleShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('capsuleshape3d', ['CapsuleShape3D']);

export { decodeCapsuleShape3D } from './decode';
export type { CapsuleShape3DProperties } from './types';
