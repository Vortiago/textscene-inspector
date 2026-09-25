/**
 * Gradient resource slice entry point (ADR-0031). One slice claims `Gradient` and
 * `GradientTexture2D`, since one `decode.ts` decodes both. THREE-free and
 * React-free: `build.ts` and `resolveGradientTexture.ts` import THREE, so this
 * re-exports `decode.ts` and `types.ts` only.
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
