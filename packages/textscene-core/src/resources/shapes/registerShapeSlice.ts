/**
 * Shared claim shape for the collision-shape slices (ADR-0031).
 *
 * Every shape is a Godot-text slice served by the generic `resource` bus slot,
 * so the claims differ only in the folder name and the type names decoded —
 * this keeps nine `index.ts` bodies from restating the same four fields.
 *
 * No `extensions`: `.tres` is the container every Godot-text slice shares, and
 * a duplicate extension claim throws. Shapes route by `type=` name alone.
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
