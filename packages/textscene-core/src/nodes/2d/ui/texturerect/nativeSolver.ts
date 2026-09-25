/**
 * TextureRect's native (WebGL canvas) rect solver: `expand_mode`'s minimum size
 * (`texture_rect.cpp:107-133`), the `stretch_mode` draw rect (`NOTIFICATION_DRAW`, `:33-100`), the
 * sampler mapping (`scene/main/canvas_item.h`) and the flip UV mirror. Pure per-node math, no THREE
 * or React: `Component.tsx` paints.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { TextureRectProperties } from './types';

const EXPAND_KEEP_SIZE = 0;
const EXPAND_IGNORE_SIZE = 1;
const EXPAND_FIT_WIDTH = 2;
const EXPAND_FIT_WIDTH_PROPORTIONAL = 3;
const EXPAND_FIT_HEIGHT = 4;
const EXPAND_FIT_HEIGHT_PROPORTIONAL = 5;

/**
 * `TextureRect::get_minimum_size()` (`texture_rect.cpp:107-133`): `Size2()` (`:132`) until a texture
 * loads (`:108`), as a `null` `SolveNode.textureSize` expresses. Each mode returns `Size2(h, 0)` or
 * `Size2(0, w)`, zero on the axis Godot never floors.
 */
export const textureRectMinimumSize: MinimumSizeFn = (n, ctx) => {
  const textureSize = n.textureSize;
  // A cached texture with no image dimensions yields a non-null 0x0 size, which the PROPORTIONAL
  // branches divide by, as `textureRectDraw` guards against. The NaN would spread into every sibling.
  if (!textureSize || textureSize.x <= 0 || textureSize.y <= 0) return { x: 0, y: 0 };
  const props = n.node.properties as TextureRectProperties;
  const tentative = ctx.tentativeRect?.(n);
  // FIT_* reads the resolved size on the axis it does not drive (`get_size()`, :117,120 and :125,128).
  // The first pass has no rect and substitutes the texture's size, which the formula makes exact
  // (nativeSolver.test.ts), so a lone control converges there. The second pass reads `tentative.h`/`tentative.w`.
  const currentHeight = tentative?.h ?? textureSize.y;
  const currentWidth = tentative?.w ?? textureSize.x;

  switch (props.expandMode ?? EXPAND_KEEP_SIZE) {
    case EXPAND_KEEP_SIZE:
      return { x: textureSize.x, y: textureSize.y };
    case EXPAND_FIT_WIDTH:
      return { x: currentHeight, y: 0 };
    case EXPAND_FIT_WIDTH_PROPORTIONAL: {
      const ratio = textureSize.x / textureSize.y;
      return { x: currentHeight * ratio, y: 0 };
    }
    case EXPAND_FIT_HEIGHT:
      return { x: 0, y: currentWidth };
    case EXPAND_FIT_HEIGHT_PROPORTIONAL: {
      const ratio = textureSize.y / textureSize.x;
      return { x: 0, y: currentWidth * ratio };
    }
    case EXPAND_IGNORE_SIZE:
    default:
      return { x: 0, y: 0 };
  }
};

const STRETCH_SCALE = 0;
const STRETCH_TILE = 1;
const STRETCH_KEEP = 2;
const STRETCH_KEEP_CENTERED = 3;
const STRETCH_KEEP_ASPECT = 4;
const STRETCH_KEEP_ASPECT_CENTERED = 5;
const STRETCH_KEEP_ASPECT_COVERED = 6;

export interface TextureRectDraw {
  /** Where the drawn image's top-left sits, Godot pixels, relative to the control's own top-left. */
  offset: Vec2;
  /** The drawn image's size, Godot pixels. It may differ from the control's rect. */
  size: Vec2;
  /** A texture-pixel-space UV crop (KEEP_ASPECT_COVERED only). Every other mode samples the whole texture. */
  region?: Rect2;
  /** STRETCH_TILE: the sampler repeats `size` (the natural texture size) across the full control rect. */
  tile: boolean;
}

/**
 * The `NOTIFICATION_DRAW` switch on `stretch_mode` (`texture_rect.cpp:45-90`), short of the draw
 * (`:95-99`) and the flip (`:92-93`, `applyFlip`), which changes only how the sampler reads.
 * `rectSize` is `get_size()`, known here because painting follows the rect pass.
 */
export function textureRectDraw(
  rectSize: Vec2,
  textureSize: Vec2,
  stretchMode: number | undefined
): TextureRectDraw {
  const fullRect: TextureRectDraw = {
    offset: { x: 0, y: 0 },
    size: { x: rectSize.x, y: rectSize.y },
    region: undefined,
    tile: false,
  };

  // A zero-dimension texture would divide by zero below. Godot's `texture.is_valid()`
  // (`:36-38`) implies positive dimensions, so this guard only stops NaN geometry.
  if (textureSize.x <= 0 || textureSize.y <= 0) return fullRect;

  switch (stretchMode ?? STRETCH_SCALE) {
    case STRETCH_SCALE:
      return fullRect;

    case STRETCH_TILE:
      return { ...fullRect, tile: true };

    case STRETCH_KEEP:
      return { offset: { x: 0, y: 0 }, size: { x: textureSize.x, y: textureSize.y }, region: undefined, tile: false };

    case STRETCH_KEEP_CENTERED:
      return {
        offset: { x: (rectSize.x - textureSize.x) / 2, y: (rectSize.y - textureSize.y) / 2 },
        size: { x: textureSize.x, y: textureSize.y },
        region: undefined,
        tile: false,
      };

    case STRETCH_KEEP_ASPECT:
    case STRETCH_KEEP_ASPECT_CENTERED: {
      // `int tex_width` / `int tex_height` (`texture_rect.cpp:63-69`): both
      // sides of the aspect fit truncate, and so does the `size.height` /
      // `size.width` each falls back to. The offsets below stay fractional:
      // `offset` is a `Point2`, and its halving is float division.
      let texWidth = Math.trunc((textureSize.x * rectSize.y) / textureSize.y);
      let texHeight = Math.trunc(rectSize.y);
      if (texWidth > rectSize.x) {
        texWidth = Math.trunc(rectSize.x);
        texHeight = Math.trunc((textureSize.y * texWidth) / textureSize.x);
      }
      let offsetX = 0;
      let offsetY = 0;
      if (stretchMode === STRETCH_KEEP_ASPECT_CENTERED) {
        offsetX = (rectSize.x - texWidth) / 2;
        offsetY = (rectSize.y - texHeight) / 2;
      }
      return { offset: { x: offsetX, y: offsetY }, size: { x: texWidth, y: texHeight }, region: undefined, tile: false };
    }

    case STRETCH_KEEP_ASPECT_COVERED: {
      const scaleX = rectSize.x / textureSize.x;
      const scaleY = rectSize.y / textureSize.y;
      const scale = Math.max(scaleX, scaleY);
      const scaledTexW = textureSize.x * scale;
      const scaledTexH = textureSize.y * scale;
      const region: Rect2 = {
        x: Math.abs((scaledTexW - rectSize.x) / scale) / 2,
        y: Math.abs((scaledTexH - rectSize.y) / scale) / 2,
        w: rectSize.x / scale,
        h: rectSize.y / scale,
      };
      return { offset: { x: 0, y: 0 }, size: { x: rectSize.x, y: rectSize.y }, region, tile: false };
    }

    default:
      return fullRect;
  }
}

const TEXTURE_FILTER_NEAREST = 1;
const TEXTURE_FILTER_LINEAR = 2;
const TEXTURE_FILTER_NEAREST_WITH_MIPMAPS = 3;
const TEXTURE_FILTER_LINEAR_WITH_MIPMAPS = 4;
const TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC = 5;
const TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC = 6;

export type TextureRectFilter = 'nearest' | 'linear';

/**
 * `CanvasItem::TextureFilter` (`scene/main/canvas_item.h:52-60`), already resolved up the ancestors,
 * to a three.js filter. `undefined` maps to LINEAR, the `Viewport::default_canvas_item_texture_filter`
 * default (`scene/main/viewport.h:419`). Mipmapped and anisotropic variants collapse to the base filter.
 */
export function resolveTextureRectFilter(filter: number | undefined): TextureRectFilter {
  switch (filter) {
    case TEXTURE_FILTER_NEAREST:
    case TEXTURE_FILTER_NEAREST_WITH_MIPMAPS:
    case TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC:
      return 'nearest';
    case TEXTURE_FILTER_LINEAR:
    case TEXTURE_FILTER_LINEAR_WITH_MIPMAPS:
    case TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC:
    default:
      return 'linear';
  }
}

const TEXTURE_REPEAT_ENABLED = 2;
const TEXTURE_REPEAT_MIRROR = 3;

export type TextureRectRepeat = 'clamp' | 'repeat' | 'mirror';

/**
 * `CanvasItem::TextureRepeat` (`scene/main/canvas_item.h:63-69`), already resolved up the ancestors,
 * to a three.js wrap mode. `undefined` maps to `'clamp'`: `DISABLED`, the
 * `Viewport::default_canvas_item_texture_repeat` default (`scene/main/viewport.h:420`).
 */
export function resolveTextureRectRepeat(repeat: number | undefined): TextureRectRepeat {
  switch (repeat) {
    case TEXTURE_REPEAT_ENABLED:
      return 'repeat';
    case TEXTURE_REPEAT_MIRROR:
      return 'mirror';
    default:
      return 'clamp';
  }
}

/**
 * `size *= flip ? -1 : 1` (`texture_rect.cpp:92-93`) mirrors the destination quad, crop and all.
 * three.js has no negative-size quad, so this reverses the UV sweep over the same window (`offset +
 * repeat`, `-repeat`), composed onto the caller's repeat and offset, so it runs last. Under
 * `RepeatWrapping`, GLSL's floor-mod `fract()` lands on Godot's `(rectSize - x) mod textureSize`.
 */
export function applyFlip(
  repeat: Vec2,
  offset: Vec2,
  flipH: boolean,
  flipV: boolean
): { repeat: Vec2; offset: Vec2 } {
  return {
    repeat: { x: flipH ? -repeat.x : repeat.x, y: flipV ? -repeat.y : repeat.y },
    offset: { x: flipH ? offset.x + repeat.x : offset.x, y: flipV ? offset.y + repeat.y : offset.y },
  };
}
