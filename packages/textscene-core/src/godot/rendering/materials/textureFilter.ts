/** The texture filter a BaseMaterial3D, a Label3D or a Sprite3D samples with. */

import { enumNamesByValue } from '../../classdb/enumNames.js';

/**
 * `BaseMaterial3D::TextureFilter` (scene/resources/material.h:171-178), not
 * `TEXTURE_FILTER`: `CanvasItem::TextureFilter` (canvasitem/shared) prepends
 * `PARENT_NODE` at 0, and `Viewport::DefaultCanvasItemTextureFilter`
 * (viewport/shared) has four, with the two `_WITH_MIPMAPS` values swapped.
 */
export const TextureFilter = {
  NEAREST: 0,
  LINEAR: 1,
  NEAREST_WITH_MIPMAPS: 2,
  LINEAR_WITH_MIPMAPS: 3,
  NEAREST_WITH_MIPMAPS_ANISOTROPIC: 4,
  LINEAR_WITH_MIPMAPS_ANISOTROPIC: 5,
} as const;

export const TEXTURE_FILTER_NAMES = enumNamesByValue(TextureFilter);
