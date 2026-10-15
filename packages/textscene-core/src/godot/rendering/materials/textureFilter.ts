/** The texture filter a BaseMaterial3D, a Label3D or a Sprite3D samples with. */

/**
 * `BaseMaterial3D::TextureFilter` (scene/resources/material.h:171-178), not
 * `TEXTURE_FILTER`: `CanvasItem::TextureFilter` (canvasitem/shared) prepends
 * `PARENT_NODE` at 0, and `Viewport::DefaultCanvasItemTextureFilter`
 * (viewport/shared) has four, with the two `_WITH_MIPMAPS` values swapped.
 */
export const BASE_MATERIAL_TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'NEAREST_WITH_MIPMAPS',
  3: 'LINEAR_WITH_MIPMAPS',
  4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
} as const;
