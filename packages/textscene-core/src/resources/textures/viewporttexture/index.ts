/**
 * ViewportTexture resource slice — registration only.
 *
 * `busType: null` because this is the one texture type the loader never serves:
 * a ViewportTexture names a NODE (`viewport_path = NodePath("…")`), so its pixels
 * come from whatever a `<SubViewport>` rendered offscreen, never from a file.
 * Routing must therefore answer "no bus" rather than guess a texture slot and
 * park a request that can never complete.
 *
 * The consumer adapter (`useViewportTextureSlot.ts`) lives beside this file but
 * is deliberately NOT imported here: it reads three r3f contexts, and this entry
 * point stays THREE-free and React-free like every other slice index.
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
