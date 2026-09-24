/**
 * NavigationPolygon resource slice entry (ADR-0031): the 2D walkable surface a
 * NavigationRegion2D draws as a debug overlay. No `build.ts`: the shared
 * `r3f/navigationOverlay.ts` builds the geometry, so this entry stays THREE- and
 * React-free for claim consumers.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'navigationpolygon',
  kind: 'godot-text',
  typeNames: ['NavigationPolygon'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeNavigationPolygon } from './decode';
export type { NavigationPolygonData } from './types';
