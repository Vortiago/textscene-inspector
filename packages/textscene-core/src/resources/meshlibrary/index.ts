/**
 * MeshLibrary resource slice — Godot-text kind (ADR-0031).
 *
 * `decode.ts` turns a MeshLibrary **ParsedResource** into the
 * `MeshLibraryModel`. There is no `build.ts`: an item resolves to a
 * **Sub-resource path** (ADR-0029) that the ArrayMesh slice builds on its own
 * bus slot, so this slice hands out addresses, never THREE objects.
 *
 * No `extensions` claim: a MeshLibrary arrives as `.tres`, the shared
 * Godot-text container. Routing is by type name.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'meshlibrary',
  kind: 'godot-text',
  typeNames: ['MeshLibrary'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export type { MeshLibraryItem, MeshLibraryModel } from './types';
