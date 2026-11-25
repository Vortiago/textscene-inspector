/** The texture filter a BaseMaterial3D, a Label3D or a Sprite3D samples with. */

import { enumNamesByValue, type EnumValue } from '../../classdb/enumNames.js';

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

/** Each filter's word in a sampler hint, past `filter_` (`shader_language.cpp:395-400`). */
export const TEXTURE_FILTER_WORDS = {
  [TextureFilter.NEAREST]: 'nearest',
  [TextureFilter.LINEAR]: 'linear',
  [TextureFilter.NEAREST_WITH_MIPMAPS]: 'nearest_mipmap',
  [TextureFilter.LINEAR_WITH_MIPMAPS]: 'linear_mipmap',
  [TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC]: 'nearest_mipmap_anisotropic',
  [TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC]: 'linear_mipmap_anisotropic',
} as const satisfies Readonly<Record<EnumValue<typeof TextureFilter>, string>>;

export type TextureFilterWord = (typeof TEXTURE_FILTER_WORDS)[EnumValue<typeof TextureFilter>];
