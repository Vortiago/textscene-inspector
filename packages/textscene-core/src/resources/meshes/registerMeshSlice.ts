/**
 * Shared claim shape for the primitive-mesh slices (ADR-0031): plain data on the
 * generic `resource` bus slot, so claims differ only in folder and type name. No
 * `extensions`: every Godot-text slice shares `.tres`, and a duplicate extension
 * claim throws, so primitive meshes route by `type=` name.
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
