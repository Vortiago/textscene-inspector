/** ConvexPolygonShape3D resource slice — claims the type name, re-exports its decode. */

import { registerShapeSlice } from '../registerShapeSlice';

registerShapeSlice('convexpolygonshape3d', ['ConvexPolygonShape3D']);

export { decodeConvexPolygonShape3D } from './decode';
export type { ConvexPolygonShape3DProperties } from './types';
