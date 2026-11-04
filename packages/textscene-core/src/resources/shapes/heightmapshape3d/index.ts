/** HeightMapShape3D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('heightmapshape3d', ['HeightMapShape3D']);

export { decodeHeightMapShape3D } from './decode';
export type { HeightMapShape3DProperties } from './types';
