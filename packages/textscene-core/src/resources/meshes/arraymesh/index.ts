/**
 * ArrayMesh resource slice entry point (ADR-0031): the routing claim plus the
 * decode surface.
 *
 * THREE-free — `build.ts` is the only file here that imports three, and nothing
 * routing-side may pull it in. The claim's `arraymesh` bus slot is its own
 * because the cached artifact is a BufferGeometry plus per-surface material
 * paths, not a ParsedResource; `failureLabel` names the consumer rather than the
 * type because a missing mesh is reported against the node that wanted it.
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
