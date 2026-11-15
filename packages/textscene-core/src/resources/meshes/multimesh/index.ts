/**
 * MultiMesh resource slice entry point (ADR-0031): claims the instance set a MultiMeshInstance3D
 * holds. It decodes to plain numbers for the instance's box and for its draw, so there is no
 * `build.ts`. THREE-free and React-free.
 */

import { registerResourceSlice } from '../../sliceRegistration.js';

registerResourceSlice({
  slice: 'multimesh',
  kind: 'godot-text',
  typeNames: ['MultiMesh'],
  busType: 'resource',
});

export { MULTI_MESH, type HeldMultiMesh } from './kind.js';
export { multiMeshAabb } from './aabb.js';
export { multiMeshInstanceArrays, type InstanceArrays } from './instanceBuffer.js';
export { multiMeshInstances } from './instanceRecords.js';
export type { DrawnInstances, MultiMeshData, MultiMeshInstance } from './types.js';
