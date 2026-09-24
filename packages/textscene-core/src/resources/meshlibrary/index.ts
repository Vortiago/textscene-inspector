/**
 * MeshLibrary resource slice, Godot-text kind (ADR-0031). No `build.ts`: an item
 * resolves to a **Sub-resource path** (ADR-0032) that the ArrayMesh slice builds.
 * No `extensions` claim: a MeshLibrary arrives as the shared `.tres` container
 * and routes by type name.
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
