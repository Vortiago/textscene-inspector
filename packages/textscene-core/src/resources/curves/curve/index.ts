/**
 * Curve resource slice — entry point (ADR-0031).
 *
 * Claims Godot's 1-D `Curve` (the scalar `f(offset) -> value` resource particle
 * parameters and the editor's curve widget use), decoded from either arrival
 * path by `decode.ts`. A Curve resolves to no THREE object at all, so the slice
 * has no `build.ts`: `sample.ts` is the internal consumer-facing evaluator.
 *
 * THREE-free and React-free, so claim consumers can read the registration
 * without pulling a renderer into their import closure.
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
