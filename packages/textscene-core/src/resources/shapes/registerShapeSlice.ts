/**
 * Shared claim shape for the collision-shape slices (ADR-0031): each is served
 * by the generic `resource` bus slot, so claims differ only in folder and type
 * names. No `extensions`: every Godot-text slice shares `.tres`, and a duplicate
 * extension claim throws, so shapes route by `type=` name alone.
 */

import { registerResourceSlice } from '../sliceRegistration';

export function registerShapeSlice(slice: string, typeNames: readonly string[]): void {
  registerResourceSlice({
    slice,
    kind: 'godot-text',
    typeNames,
    busType: 'resource',
    failureLabel: 'Resource',
  });
}
