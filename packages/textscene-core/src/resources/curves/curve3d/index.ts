/**
 * Curve3D resource slice entry point (ADR-0031): claims the Bézier path a Path3D
 * holds and a PATH-mode CSGPolygon3D sweeps along. It decodes to plain numbers, so
 * there is no `build.ts`. THREE-free and React-free, so a claim consumer pulls in no renderer.
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
