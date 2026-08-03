/**
 * NoiseTexture2D resource slice — registration + the slice's public surface.
 *
 * Claims the generic `resource` slot: a NoiseTexture2D is usually an inline
 * `[sub_resource]`, but a project may ship one as a standalone `.tres` that a
 * material references, and routing must answer for that file rather than guess
 * a texture slot the loader cannot fill (nothing to fetch — the pixels are
 * generated).
 *
 * THREE-free and React-free: `build.ts` (the rasteriser, which pulls in THREE
 * and the noise library) is reached through `resolveNoiseTexture.ts`, never from
 * here.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'noisetexture2d',
  kind: 'godot-text',
  typeNames: ['NoiseTexture2D'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export * from './decode';
export * from './types';
