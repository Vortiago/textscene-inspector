/**
 * The size a Texture2D reports while its scene loads, before Godot sets any ViewportTexture up
 * (`viewport.cpp:156-160`). Wrappers peel, an AtlasTexture reports its region, and a texture only
 * its image file sizes has no size here. No THREE.
 */

import { atlasTextureSize } from '../atlastexture/decode';
import { savedImageSize } from '../image/decode';
import { NO_AREA, type Texture2DSize } from '../../texture2DSize';
import type { Texture2D } from './types';

/** Null for a texture only its image file sizes, which the loader imports. */
export function texture2DSizeAtLoad(texture: Texture2D): Texture2DSize | null {
  switch (texture.form) {
    case 'canvas':
      return texture.diffuse.value && texture2DSizeAtLoad(texture.diffuse.value);
    case 'atlas': {
      const sheet = texture.sheet.value && texture2DSizeAtLoad(texture.sheet.value);
      const reported = atlasTextureSize(texture.atlas, sheet && { width: sheet.x, height: sheet.y });
      return reported && { x: reported.width, y: reported.height };
    }
    case 'viewport':
      return NO_AREA;
    // The declared size: neither getter consults the texture's source
    // (`scene/resources/gradient_texture.cpp`, `modules/noise/noise_texture_2d.cpp:378-384`).
    case 'gradient':
    case 'noise':
      return { x: texture.texture.width, y: texture.texture.height };
    // An ImageTexture's size is its image's (`scene/resources/image_texture.cpp:74-75`, `:122-128`).
    case 'image': {
      const size = savedImageSize(texture.image);
      return size && { x: size.width, y: size.height };
    }
    case 'file':
      return null;
  }
}
