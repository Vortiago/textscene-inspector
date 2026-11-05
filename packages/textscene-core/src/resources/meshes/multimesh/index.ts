/**
 * MultiMesh resource slice entry point (ADR-0031): claims the instance set a MultiMeshInstance3D
 * holds. It decodes to plain numbers for the instance's box and the instances to draw, so there is no
 * `build.ts`. THREE-free and React-free; `useMultiMeshData.ts` is its hook.
 */

import { registerResourceSlice } from '../../sliceRegistration.js';

registerResourceSlice({
  slice: 'multimesh',
  kind: 'godot-text',
  typeNames: ['MultiMesh'],
  busType: 'resource',
});

export { multiMeshAabb } from './aabb.js';
export type { DecodedMultiMesh, MultiMeshData, MultiMeshInstance } from './types.js';
