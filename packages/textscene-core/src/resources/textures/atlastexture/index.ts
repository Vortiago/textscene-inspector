/**
 * AtlasTexture resource slice — registration + the slice's public surface.
 *
 * Usually a sub-resource inline in the file that uses it (a scene or a
 * SpriteFrames `.tres`), decoded straight from that file's already-parsed
 * section. It can also be its OWN standalone `.tres` — every Kenney
 * input-prompt icon ships one cell per file — in which case the `resource`
 * bus fetches and parses IT, the same as any other Godot-text resource;
 * `resolveAtlasTexture.ts` decodes either form to the same shape, and only
 * the ATLAS image the cell windows ever goes through the texture bus.
 *
 * THREE-free and React-free: no `./build`, no r3f import. Its hosts window the
 * loaded atlas image themselves (`resolveTexture2DSource` + the spriteFrame
 * compositor, and `useTexture2D` for a plain Texture2D slot).
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
