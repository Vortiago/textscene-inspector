/**
 * ArrayMesh slice entry (ADR-0031): the routing claim and the decode, THREE-free.
 * The `arraymesh` bus slot is its own: the artifact is a BufferGeometry plus
 * material paths. `failureLabel` names the consumer, since a missing mesh is
 * reported against the node that wanted it.
 */

import { registerResourceSlice } from '../../sliceRegistration.js';

registerResourceSlice({
  slice: 'arraymesh',
  kind: 'godot-text',
  typeNames: ['ArrayMesh'],
  busType: 'arraymesh',
  failureLabel: 'Node using ArrayMesh',
});

export { decodeArrayMesh, decodeSceneArrayMesh } from './decode.js';
export type { ArrayMeshData, ArrayMeshSurface } from './types.js';
