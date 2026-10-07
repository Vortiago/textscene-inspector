/** RectangleShape2D resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration';

registerGenericResourceSlice('rectangleshape2d', ['RectangleShape2D']);

export { decodeRectangleShape2D } from './decode';
export type { RectangleShape2DProperties } from './types';
