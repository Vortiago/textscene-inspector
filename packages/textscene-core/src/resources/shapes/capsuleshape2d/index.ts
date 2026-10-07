/** CapsuleShape2D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('capsuleshape2d', ['CapsuleShape2D']);

export { decodeCapsuleShape2D } from './decode';
export type { CapsuleShape2DProperties } from './types';
