/**
 * NinePatchRect's native rect solver, `get_minimum_size` (`scene/gui/nine_patch_rect.cpp:53-55`): the
 * margins summed per axis, whether or not a texture loaded, unlike TextureRect's `EXPAND_KEEP_SIZE`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { NinePatchRectProperties } from './types';

export const ninePatchRectMinimumSize: MinimumSizeFn = (n): Vec2 => {
  const props = n.node.properties as NinePatchRectProperties;
  const left = props.patchMarginLeft ?? 0;
  const top = props.patchMarginTop ?? 0;
  const right = props.patchMarginRight ?? 0;
  const bottom = props.patchMarginBottom ?? 0;
  return { x: left + right, y: top + bottom };
};

const TEXTURE_FILTER_NEAREST = 1;
const TEXTURE_FILTER_NEAREST_WITH_MIPMAPS = 3;
const TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC = 5;

export type NinePatchRectFilter = 'nearest' | 'linear';

/**
 * `CanvasItem::TextureFilter` (`scene/main/canvas_item.h:52-60`) as three.js filters: the mapping of
 * `texturerect/nativeSolver.ts`'s `resolveTextureRectFilter`, copied, not imported across slices. `filter`
 * is already resolved up the ancestors by `useInheritedTextureSampler`. Undefined maps to LINEAR, the class
 * default of `Viewport::default_canvas_item_texture_filter` (`scene/main/viewport.h:419`).
 */
export function resolveNinePatchFilter(filter: number | undefined): NinePatchRectFilter {
  switch (filter) {
    case TEXTURE_FILTER_NEAREST:
    case TEXTURE_FILTER_NEAREST_WITH_MIPMAPS:
    case TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC:
      return 'nearest';
    default:
      return 'linear';
  }
}
