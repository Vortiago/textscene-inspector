/** SeparationRayShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('separationrayshape3d', ['SeparationRayShape3D']);

export { decodeSeparationRayShape3D } from './decode';
