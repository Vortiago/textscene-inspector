/** ConcavePolygonShape3D resource slice — claims the type name, re-exports its decode. */

import { registerShapeSlice } from '../registerShapeSlice';

registerShapeSlice('concavepolygonshape3d', ['ConcavePolygonShape3D']);

export { decodeConcavePolygonShape3D } from './decode';
export type { ConcavePolygonShape3DProperties } from './types';
