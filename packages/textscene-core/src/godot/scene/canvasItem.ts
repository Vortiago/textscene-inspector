/** CanvasItem's own enums, as the engine declares them. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `CanvasItem::ClipChildrenMode` (`scene/main/canvas_item.h:71-74`), the serialised values of
 * `clip_children`, without its `_MAX`. CanvasGroup's rule asks only whether an ancestor clips, as
 * Godot tests `get_clip_children_mode() != CLIP_CHILDREN_DISABLED` (`canvas_group.cpp:76`,
 * `canvas_item.cpp:1308`).
 */
export enum CanvasItemClipChildrenMode {
  DISABLED = 0,
  ONLY = 1,
  AND_DRAW = 2,
}

/** The names Godot binds (`BIND_ENUM_CONSTANT`, `canvas_item.cpp:1525-1527`). */
export const CANVAS_ITEM_CLIP_CHILDREN_MODE_NAMES = enumNamesByValue(CanvasItemClipChildrenMode);

/**
 * `CLIP_CHILDREN_MAX` (`canvas_item.h:75`), a count sentinel, not a mode, so the legal span is
 * 0..2. `set_clip_children_mode` fails on `>= CLIP_CHILDREN_MAX` (`canvas_item.cpp:1733`) after an
 * int32 narrowing, so only 3..2147483647 trips it. Measured on 4.6.3: `4294967295`, the
 * serialiser's `-1`, lands negative, passes the guard and clips.
 */
export const CANVAS_ITEM_CLIP_CHILDREN_MODE_COUNT = 3;

/**
 * `CanvasItem::TextureFilter` (`scene/main/canvas_item.h:52-60`), without `TEXTURE_FILTER_MAX`, as the
 * integers a `.tscn` stores for `texture_filter`. PARENT_NODE at 0 defers to the ancestors, and the
 * default is PARENT_NODE (`canvas_item.h:123`). `BaseMaterial3D::TextureFilter` has no PARENT_NODE
 * (`rendering/materials/textureFilter.ts`).
 */
export enum CanvasItemTextureFilter {
  PARENT_NODE = 0,
  NEAREST = 1,
  LINEAR = 2,
  NEAREST_WITH_MIPMAPS = 3,
  LINEAR_WITH_MIPMAPS = 4,
  NEAREST_WITH_MIPMAPS_ANISOTROPIC = 5,
  LINEAR_WITH_MIPMAPS_ANISOTROPIC = 6,
}

/** Each filter's name by the integer a `.tscn` stores (`canvas_item.cpp:1510-1516`), as a validator names it. */
export const CANVAS_ITEM_TEXTURE_FILTER_NAMES = enumNamesByValue(CanvasItemTextureFilter);

/**
 * The texel a filter, already resolved up the ancestors, samples. Mipmapped and anisotropic variants
 * collapse to their base filter. Anything else, including no filter at all, is linear: the
 * `Viewport::default_canvas_item_texture_filter` default (`scene/main/viewport.h:419`).
 */
export function canvasItemSamplerFilter(filter: number | undefined): 'nearest' | 'linear' {
  switch (filter) {
    case CanvasItemTextureFilter.NEAREST:
    case CanvasItemTextureFilter.NEAREST_WITH_MIPMAPS:
    case CanvasItemTextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC:
      return 'nearest';
    default:
      return 'linear';
  }
}

/**
 * `CanvasItem::TextureRepeat` (`scene/main/canvas_item.h:63-69`), without `TEXTURE_REPEAT_MAX`, as the
 * integers a `.tscn` stores for `texture_repeat`. PARENT_NODE at 0 defers to the ancestors.
 */
export enum CanvasItemTextureRepeat {
  PARENT_NODE = 0,
  DISABLED = 1,
  ENABLED = 2,
  MIRROR = 3,
}

/** Each repeat's name by the integer a `.tscn` stores (`canvas_item.cpp:1519-1522`), as a validator names it. */
export const CANVAS_ITEM_TEXTURE_REPEAT_NAMES = enumNamesByValue(CanvasItemTextureRepeat);
