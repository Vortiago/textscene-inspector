/** CapsuleShape2D resource slice: claims the type name, re-exports its decode. */

import { registerShapeSlice } from '../registerShapeSlice';

registerShapeSlice('capsuleshape2d', ['CapsuleShape2D']);

export { decodeCapsuleShape2D } from './decode';
export type { CapsuleShape2DProperties } from './types';
