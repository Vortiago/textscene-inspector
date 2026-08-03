/** CircleShape2D resource slice — claims the type name, re-exports its decode. */

import { registerShapeSlice } from '../registerShapeSlice';

registerShapeSlice('circleshape2d', ['CircleShape2D']);

export { decodeCircleShape2D } from './decode';
export type { CircleShape2DProperties } from './types';
