/**
 * FastNoiseLite resource slice — registration + the slice's public surface.
 *
 * A `Noise` is never sampled on its own: a NoiseTexture2D holds one and turns it
 * into pixels. It still claims the generic `resource` slot, because a Godot
 * project may ship one as a standalone `.tres` that a texture references by
 * `ExtResource`, and routing must answer for that file rather than guess.
 *
 * THREE-free and React-free: the generator library is only reached from the
 * texture slice's `build.ts`.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'fastnoiselite',
  kind: 'godot-text',
  typeNames: ['FastNoiseLite'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export * from './decode';
export * from './types';
