/**
 * NoiseTexture2D resource slice: registration and public surface. It claims the
 * `resource` slot for a standalone `.tres`, since the texture slot has nothing to
 * fetch. THREE-free and React-free: `build.ts` is reached through
 * `resolveNoiseTexture.ts`, never from here.
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
