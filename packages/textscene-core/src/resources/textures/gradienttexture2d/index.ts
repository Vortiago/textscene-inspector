/**
 * Gradient resource slice entry point (ADR-0031). One slice claims `Gradient` and
 * `GradientTexture2D`, since one `decode.ts` decodes both. THREE-free and
 * React-free: `build.ts` and `resolveGradientTexture.ts` import THREE, so this
 * re-exports the data types only.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'gradienttexture2d',
  kind: 'godot-text',
  typeNames: ['Gradient', 'GradientTexture2D'],
  busType: 'resource',
});

export type { Gradient, GradientColorStop, GradientTexture2D } from './types';
