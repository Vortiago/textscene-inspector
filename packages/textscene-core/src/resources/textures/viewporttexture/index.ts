/**
 * ViewportTexture resource slice, registration only. `busType: null`: it names a
 * node (`viewport_path = NodePath("…")`), not a file, so a texture slot would park
 * a request that never completes. `useViewportTextureSlot.ts` reads r3f contexts,
 * so this THREE-free, React-free index does not import it.
 */

import { registerResourceSlice } from '../../sliceRegistration';

import { VIEWPORT_TEXTURE_TYPE } from './types';

registerResourceSlice({
  slice: 'viewporttexture',
  kind: 'godot-text',
  typeNames: [VIEWPORT_TEXTURE_TYPE],
  busType: null,
  failureLabel: 'Viewport texture',
});

export * from './types';
