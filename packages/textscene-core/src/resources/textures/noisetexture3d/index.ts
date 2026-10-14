/**
 * NoiseTexture3D resource slice: registration and public surface. It claims the `resource` slot
 * for a standalone `.tres`, since nothing is fetched. THREE-free and React-free: `build.ts` is
 * reached through `resolveNoiseTexture.ts`, never from here.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'noisetexture3d',
  kind: 'godot-text',
  typeNames: ['NoiseTexture3D'],
  busType: 'resource',
});

export * from './decode';
export * from './types';
