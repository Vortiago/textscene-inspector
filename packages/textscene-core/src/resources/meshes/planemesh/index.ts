/** PlaneMesh resource slice — claims the type name, re-exports its decode. */

import { registerMeshSlice } from '../registerMeshSlice.js';

registerMeshSlice('planemesh', ['PlaneMesh']);

export { decodePlaneMesh } from './decode.js';
export type { PlaneMeshProperties } from './types.js';
