/**
 * NavigationPolygon resource slice — entry point (ADR-0031).
 *
 * Claims Godot's `NavigationPolygon`, the 2D walkable surface a
 * NavigationRegion2D draws as a debug overlay. It decodes to plain vertex and
 * index arrays; the THREE geometries are built by the shared overlay adapter
 * (`r3f/navigationOverlay.ts`), which both navigation slices feed, so this slice
 * has no `build.ts`.
 *
 * THREE-free and React-free, so claim consumers can read the registration
 * without pulling a renderer into their import closure.
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
