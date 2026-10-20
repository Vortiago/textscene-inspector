/** ConcavePolygonShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('concavepolygonshape3d', ['ConcavePolygonShape3D']);

export { decodeConcavePolygonShape3D } from './decode';
