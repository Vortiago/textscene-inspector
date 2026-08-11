/**
 * Curve3D resource slice — entry point (ADR-0031).
 *
 * Claims Godot's `Curve3D`, the Bézier path a Path3D holds, a PathFollow3D
 * walks and a PATH-mode CSGPolygon3D sweeps its outline along. It decodes to
 * plain numbers (control points, then a tessellated polyline sampler), never a
 * THREE object, so the slice has no `build.ts`.
 *
 * THREE-free and React-free, so claim consumers can read the registration
 * without pulling a renderer into their import closure.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'curve3d',
  kind: 'godot-text',
  typeNames: ['Curve3D'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { parseCurve3DPoints, tessellateCurve3D } from './decode';
export type {
  Curve3DControlPoint,
  Curve3DSample,
  Curve3DSampler,
  Vec3,
} from './types';
