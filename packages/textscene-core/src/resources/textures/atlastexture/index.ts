/**
 * AtlasTexture resource slice: registration and public surface. Inline or a
 * standalone `.tres` on the `resource` bus. Only the atlas image goes through the
 * texture bus. THREE-free and React-free: `resolveTexture2DSource`, the
 * spriteFrame compositor and `useTexture2D` window the loaded atlas themselves.
 */

import { registerResourceSlice } from '../../sliceRegistration';
import { ATLAS_TEXTURE_TYPE } from './types';

registerResourceSlice({
  slice: 'atlastexture',
  kind: 'godot-text',
  typeNames: [ATLAS_TEXTURE_TYPE],
  busType: 'resource',
  failureLabel: 'Resource',
});

export * from './decode';
export * from './types';
