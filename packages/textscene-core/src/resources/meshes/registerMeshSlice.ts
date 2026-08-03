/**
 * Shared claim shape for the primitive-mesh slices (ADR-0031).
 *
 * Every PrimitiveMesh is a Godot-text slice whose decoded form is plain data on
 * the generic `resource` bus slot, so the claims differ only in the folder name
 * and the type name decoded. ArrayMesh is NOT one of these: its cached artifact
 * is a BufferGeometry, so it registers its own `arraymesh` slot inline.
 *
 * No `extensions`: `.tres` is the container every Godot-text slice shares, and a
 * duplicate extension claim throws. Primitive meshes route by `type=` name.
 */

import { registerResourceSlice } from '../sliceRegistration.js';

export function registerMeshSlice(slice: string, typeNames: readonly string[]): void {
  registerResourceSlice({
    slice,
    kind: 'godot-text',
    typeNames,
    busType: 'resource',
    failureLabel: 'Resource',
  });
}
