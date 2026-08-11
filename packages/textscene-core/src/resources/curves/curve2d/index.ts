/**
 * Curve2D resource slice — entry point (ADR-0031).
 *
 * Claims Godot's `Curve2D`, the Bézier path a Path2D holds and a PathFollow2D
 * walks. It decodes to plain numbers (control points, then a tessellated
 * polyline sampler), never a THREE object, so the slice has no `build.ts`.
 *
 * THREE-free and React-free, so claim consumers can read the registration
 * without pulling a renderer into their import closure.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'curve2d',
  kind: 'godot-text',
  typeNames: ['Curve2D'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { parseCurve2DPoints, tessellateCurve2D } from './decode';
export type {
  Curve2DControlPoint,
  Curve2DSample,
  Curve2DSampler,
  Vec2,
} from './types';
