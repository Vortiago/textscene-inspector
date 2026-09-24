/**
 * FastNoiseLite resource slice. A NoiseTexture2D samples a `Noise`, yet the slice
 * claims the generic `resource` slot, since a project may ship one as a standalone
 * `.tres` that a texture references. THREE- and React-free: only the texture
 * slice's `build.ts` reaches the generator library.
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
