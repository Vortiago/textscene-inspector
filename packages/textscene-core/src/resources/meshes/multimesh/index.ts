/**
 * MultiMesh resource slice entry point (ADR-0031): claims the instance set a MultiMeshInstance3D
 * holds. It decodes to plain numbers for the instance's box, so there is no `build.ts`. THREE-free
 * and React-free.
 */

import { registerResourceSlice } from '../../sliceRegistration.js';

registerResourceSlice({
  slice: 'multimesh',
  kind: 'godot-text',
  typeNames: ['MultiMesh'],
  busType: 'resource',
});

export { decodeMultiMesh } from './decode.js';
export { multiMeshAabb } from './aabb.js';
export type { MultiMeshData } from './types.js';
