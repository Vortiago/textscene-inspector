/**
 * AtlasTexture resource slice — registration + the slice's public surface.
 *
 * An AtlasTexture is always a sub-resource of the file that uses it (a scene or
 * a SpriteFrames `.tres`), so what the loader ever fetches for it is the ATLAS
 * image on the texture slot; the type itself decodes from the owning file's
 * already-parsed section.
 *
 * THREE-free and React-free: no `./build`, no r3f import. Its hosts window the
 * loaded atlas image themselves (`nodes/2d/animatedsprite2d/frameTexture.ts`).
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
