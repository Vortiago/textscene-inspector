/**
 * TextureRect's native (WebGL canvas) rect solver: `expand_mode`'s minimum size
 * (`texture_rect.cpp:107-133`), the `stretch_mode` draw rect (`NOTIFICATION_DRAW`, `:33-100`), the
 * sampler mapping (`scene/main/canvas_item.h`) and the draw's UV window with its flip mirror. Pure
 * per-node math, no THREE or React: `Component.tsx` paints.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../../godot/math/rect2';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { TextureRectProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { TextureStretchMode } from '../../../../godot/scene/textureStretch';
import { TextureRectExpandMode } from '../../../../godot/scene/gui';
import { FULL_UV_WINDOW, flippedUvWindow, regionUvWindow, type UvWindow } from '../../../../r3f/uvWindow';

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

  switch (props.expandMode ?? TextureRectExpandMode.EXPAND_KEEP_SIZE) {
    case TextureRectExpandMode.EXPAND_KEEP_SIZE:
      return { x: textureSize.x, y: textureSize.y };
    case TextureRectExpandMode.EXPAND_FIT_WIDTH:
      return { x: currentHeight, y: 0 };
    case TextureRectExpandMode.EXPAND_FIT_WIDTH_PROPORTIONAL: {
      const ratio = textureSize.x / textureSize.y;
      return { x: currentHeight * ratio, y: 0 };
    }
    case TextureRectExpandMode.EXPAND_FIT_HEIGHT:
      return { x: 0, y: currentWidth };
    case TextureRectExpandMode.EXPAND_FIT_HEIGHT_PROPORTIONAL: {
      const ratio = textureSize.y / textureSize.x;
      return { x: 0, y: currentWidth * ratio };
    }
    case TextureRectExpandMode.EXPAND_IGNORE_SIZE:
    default:
      return { x: 0, y: 0 };
  }
};

export interface TextureRectDraw {
  /** Where the drawn image's top-left sits, Godot pixels, relative to the control's own top-left. */
  offset: Vector2;
  /** The drawn image's size, Godot pixels. It may differ from the control's rect. */
  size: Vector2;
  /** A texture-pixel-space UV crop (KEEP_ASPECT_COVERED only). Every other mode samples the whole texture. */
  region?: Rect2;
  /** `STRETCH_TILE`: the sampler repeats `size` (the natural texture size) across the full control rect. */
  tile: boolean;
}

/**
 * The `NOTIFICATION_DRAW` switch on `stretch_mode` (`texture_rect.cpp:45-90`), short of the draw
 * (`:95-99`) and the flip (`:92-93`, `textureRectUvWindow`), which changes only how the sampler reads.
 * `rectSize` is `get_size()`, known here because painting follows the rect pass.
 */
export function textureRectDraw(
  rectSize: Vector2,
  textureSize: Vector2,
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

  switch (stretchMode ?? TextureStretchMode.STRETCH_SCALE) {
    case TextureStretchMode.STRETCH_SCALE:
      return fullRect;

    case TextureStretchMode.STRETCH_TILE:
      return { ...fullRect, tile: true };

    case TextureStretchMode.STRETCH_KEEP:
      return {
        offset: { x: 0, y: 0 },
        size: { x: textureSize.x, y: textureSize.y },
        region: undefined,
        tile: false,
      };

    case TextureStretchMode.STRETCH_KEEP_CENTERED:
      return {
        offset: { x: (rectSize.x - textureSize.x) / 2, y: (rectSize.y - textureSize.y) / 2 },
        size: { x: textureSize.x, y: textureSize.y },
        region: undefined,
        tile: false,
      };

    case TextureStretchMode.STRETCH_KEEP_ASPECT:
    case TextureStretchMode.STRETCH_KEEP_ASPECT_CENTERED: {
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
      if (stretchMode === TextureStretchMode.STRETCH_KEEP_ASPECT_CENTERED) {
        offsetX = (rectSize.x - texWidth) / 2;
        offsetY = (rectSize.y - texHeight) / 2;
      }
      return {
        offset: { x: offsetX, y: offsetY },
        size: { x: texWidth, y: texHeight },
        region: undefined,
        tile: false,
      };
    }

    case TextureStretchMode.STRETCH_KEEP_ASPECT_COVERED: {
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

/** A draw and the size of the texture it samples. */
export interface SampledDraw extends TextureRectDraw {
  textureSize: Vector2;
}

/**
 * The window over the texture before the flip. STRETCH_TILE repeats the texture over the drawn size
 * from the rect's top-left, a region of that size under `RepeatWrapping`. KEEP_ASPECT_COVERED
 * samples its crop region.
 */
function unflippedUvWindow({ tile, size, textureSize, region }: SampledDraw): UvWindow {
  if (tile) return regionUvWindow({ x: 0, y: 0, w: size.x, h: size.y }, textureSize);
  if (region) return regionUvWindow(region, textureSize);
  return FULL_UV_WINDOW;
}

/**
 * The UV window `draw` samples. `size *= flip ? -1 : 1` (`texture_rect.cpp:92-93`) mirrors the
 * destination quad, crop and all, so the flip reverses the whole window and runs last.
 */
export function textureRectUvWindow(draw: SampledDraw, flipH: boolean, flipV: boolean): UvWindow {
  return flippedUvWindow(unflippedUvWindow(draw), flipH, flipV);
}
