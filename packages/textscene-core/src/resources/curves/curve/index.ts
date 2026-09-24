/**
 * Curve resource slice entry point (ADR-0031): claims Godot's scalar `Curve`. It
 * builds no THREE object, so `sample.ts` evaluates it and there is no `build.ts`.
 * THREE-free and React-free, so a claim consumer pulls in no renderer.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'curve',
  kind: 'godot-text',
  typeNames: ['Curve'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { curveFromResource, decodeCurve, resolveCurve } from './decode';
export { CurveTangentMode, EMPTY_CURVE, type Curve, type CurvePoint } from './types';
