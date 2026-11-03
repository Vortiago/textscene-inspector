/** WorldBoundaryShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('worldboundaryshape3d', ['WorldBoundaryShape3D']);

export { decodeWorldBoundaryShape3D } from './decode';
