/**
 * ArrayMesh slice entry (ADR-0031): the routing claim and the decode, THREE-free.
 * The `arraymesh` bus slot is its own: the artifact is a BufferGeometry plus
 * material paths.
 */

import { registerResourceSlice } from '../../sliceRegistration.js';
import { ARRAY_MESH_TYPES } from './decode.js';

registerResourceSlice({
  slice: 'arraymesh',
  kind: 'godot-text',
  typeNames: [...ARRAY_MESH_TYPES],
  busType: 'arraymesh',
});

export { decodeArrayMesh, decodeSceneArrayMesh } from './decode.js';
export type { ArrayMeshData, ArrayMeshSurface } from './types.js';
