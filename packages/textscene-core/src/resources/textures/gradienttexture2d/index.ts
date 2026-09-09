/**
 * Gradient resource slice — entry point (ADR-0031).
 *
 * One slice, two claims: `GradientTexture2D` is meaningless without the
 * `Gradient` it rasterises, and both are decoded by the same `decode.ts`, so
 * splitting them would put one type's decode in another slice's folder.
 *
 * THREE-free and React-free — it re-exports `decode.ts` and `types.ts` only.
 * `build.ts` (the rasteriser) and `resolveGradientTexture.ts` (its resolve
 * adapter) import THREE, so a claim consumer reaching them through this file
 * would pull a renderer into the linter's import closure.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'gradienttexture2d',
  kind: 'godot-text',
  typeNames: ['Gradient', 'GradientTexture2D'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export {
  decodeGradient,
  decodeGradientTexture2D,
  gradientFromResource,
  parseColorStops,
  parsePackedFloat32Array,
  resolveGradient,
} from './decode';
export {
  GradientFill,
  GradientInterpolationMode,
  GradientRepeat,
  type Gradient,
  type GradientColorStop,
  type GradientTexture2D,
} from './types';
