/** CylinderShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('cylindershape3d', ['CylinderShape3D']);

export { decodeCylinderShape3D } from './decode';
export type { CylinderShape3DProperties } from './types';
