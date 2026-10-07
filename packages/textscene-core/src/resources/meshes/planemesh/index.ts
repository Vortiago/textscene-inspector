/** PlaneMesh resource slice: claims the type name, re-exports its decode. */

import { registerGenericResourceSlice } from '../../sliceRegistration.js';

registerGenericResourceSlice('planemesh', ['PlaneMesh']);

export { decodePlaneMesh } from './decode.js';
export type { PlaneMeshProperties } from './types.js';
