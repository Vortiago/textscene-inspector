/**
 * ImageTexture3D resource slice: registration. It claims the `resource` slot for a standalone
 * `.tres`, since its pixels are saved inline. THREE-free: `resolveImageTexture3D.ts` builds it.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'imagetexture3d',
  kind: 'godot-text',
  typeNames: ['ImageTexture3D'],
  busType: 'resource',
});
