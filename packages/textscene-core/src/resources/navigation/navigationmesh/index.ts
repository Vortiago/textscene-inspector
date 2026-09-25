/**
 * NavigationMesh resource slice entry (ADR-0031): the 3D walkable surface a
 * NavigationRegion3D draws as a debug overlay. No `build.ts`: the shared
 * `r3f/navigationOverlay.ts` builds the geometry, so this entry stays THREE- and
 * React-free for claim consumers.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'navigationmesh',
  kind: 'godot-text',
  typeNames: ['NavigationMesh'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeNavigationMesh } from './decode';
export type { NavigationMeshData } from './types';
