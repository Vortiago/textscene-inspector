/** SphereShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('sphereshape3d', ['SphereShape3D']);

export { decodeSphereShape3D } from './decode';
export type { SphereShape3DProperties } from './types';
