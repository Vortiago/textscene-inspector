/** BoxShape3D resource slice: claims the type name, re-exports its decode. */

import { registerShapeSlice } from '../registerShapeSlice';

registerShapeSlice('boxshape3d', ['BoxShape3D']);

export { decodeBoxShape3D } from './decode';
export type { BoxShape3DProperties } from './types';
