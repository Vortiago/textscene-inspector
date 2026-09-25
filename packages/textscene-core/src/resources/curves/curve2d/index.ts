/**
 * Curve2D resource slice entry point (ADR-0031): claims the Bézier path a Path2D
 * holds. It decodes to plain numbers, so there is no `build.ts`. THREE-free and
 * React-free, so a claim consumer pulls in no renderer.
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
