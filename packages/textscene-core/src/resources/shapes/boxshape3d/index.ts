/** BoxShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('boxshape3d', ['BoxShape3D']);

export { decodeBoxShape3D } from './decode';
export type { BoxShape3DProperties } from './types';
