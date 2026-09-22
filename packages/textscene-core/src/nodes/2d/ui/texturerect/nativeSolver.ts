/**
 * TextureRect's native (WebGL canvas) rect solver — `expand_mode`'s
 * minimum-size contribution (`TextureRect::get_minimum_size`,
 * `texture_rect.cpp:107-133`), registered via
 * `controlSolverRegistry.registerMinimumSize`, and the `stretch_mode`
 * draw-rect math (`TextureRect::_notification`'s `NOTIFICATION_DRAW`,
 * `:33-100`) `Component.tsx` paints. Also the sampler-property mapping
 * (`CanvasItem::TextureFilter`/`TextureRepeat`, `scene/main/canvas_item.h`)
 * and the flip_h/flip_v UV mirror, since all of it is pure per-node math with
 * no THREE/React dependency — the same "no THREE" convention every other
 * `native/` SOLVER module keeps (painting lives in `Component.tsx`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { TextureRectProperties } from './types';

// --- expand_mode: minimum size -----------------------------------------

const EXPAND_KEEP_SIZE = 0;
const EXPAND_IGNORE_SIZE = 1;
const EXPAND_FIT_WIDTH = 2;
const EXPAND_FIT_WIDTH_PROPORTIONAL = 3;
const EXPAND_FIT_HEIGHT = 4;
const EXPAND_FIT_HEIGHT_PROPORTIONAL = 5;

/**
 * `TextureRect::get_minimum_size()` (`texture_rect.cpp:107-133`): gated on a
 * loaded texture exactly like Godot's own `texture.is_valid()` guard (`:108`,
 * with `Size2()` — i.e. `{x:0, y:0}` — as the `:132` fallback outside it).
 * `SolveNode.textureSize` is `null` until `buildSolveTree`'s texture-size
 * resolution lands, which is that same gate expressed through this solver's
 * own input shape.
 *
 * FIT_WIDTH/FIT_HEIGHT (and their PROPORTIONAL twins) tie one axis to the
 * OTHER axis's CURRENT, already-resolved control size (`get_size().y` /
 * `get_size().x`, `:116-129`) — genuinely self-referential. This solver's
 * minimum-size pass runs bottom-up (`controlRectSolver.ts`'s Phase 1) BEFORE
 * any rect is assigned (Phase 2), and a plain `MinimumSizeFn` is never handed
 * a parent rect (`solverRegistry.ts`), so "this node's own current size"
 * does not exist on a tree's FIRST pass.
 *
 * CLOSED via `SolveContext.tentativeRect` (`solverRegistry.ts`'s own doc) —
 * this type is registered with `controlSolverRegistry.
 * registerSizeDependentMinimum` (`index.r3f.ts`), so `solveControlTree` runs
 * a second, final pass whenever one is present in the tree, feeding this
 * function the FIRST pass's own resolved rect for the OTHER axis. On that
 * pass, `tentative.h`/`tentative.w` IS Godot's `get_size().y`/`get_size().x`
 * — the real, already-resolved control size, not a substitute. On the FIRST
 * pass (`tentative` undefined) this still substitutes the texture's OWN
 * natural size on that axis, exactly as before this closed — the only
 * non-circular per-node size datum on hand, in the same spirit as
 * EXPAND_KEEP_SIZE already using it, and ALGEBRAICALLY IDENTICAL to what the
 * corrected formula below produces once `tentative` is substituted with the
 * texture's own size on that axis (worked in `nativeSolver.test.ts`) — so a
 * tree with only one Control ever asking for this axis (no ancestor/sibling
 * whose OWN size depends on it) converges on the FIRST pass already, and the
 * second pass is a no-op for it.
 *
 * The DOM `<TextureRect>` (`Component.tsx`'s `textureRectMinSize`) maps
 * FIT_WIDTH (2) and FIT_HEIGHT (4) to the IDENTICAL CSS `aspect-ratio: 1/1`
 * (ditto the PROPORTIONAL pair, both to the texture's own aspect) — CSS
 * `aspect-ratio` is symmetric and only ever fills in whichever axis the
 * surrounding layout leaves unconstrained, so it cannot express "Godot
 * always floors WIDTH from HEIGHT, never the reverse" (or vice versa): the
 * two only actually diverge once anchors constrain BOTH axes, at which point
 * `aspect-ratio` goes inert (no auto axis left to solve) while Godot's floor
 * can still override whichever axis it names as the driven one. This
 * function returns an ASYMMETRIC `Vec2` per mode instead — zero on the axis
 * Godot never floors, non-zero on the one it does, exactly the `Size2(h, 0)`
 * / `Size2(0, w)` shape the source itself uses.
 */
export const textureRectMinimumSize: MinimumSizeFn = (n, ctx) => {
  const textureSize = n.textureSize;
  // A cached texture whose image has no dimensions yields a non-null 0x0 size, and
  // the PROPORTIONAL branches below divide by it — the same degenerate input
  // `textureRectDraw` guards against, whose NaN would spread through the
  // combined minimum into every sibling's rect.
  if (!textureSize || textureSize.x <= 0 || textureSize.y <= 0) return { x: 0, y: 0 };
  const props = n.node.properties as TextureRectProperties;
  const tentative = ctx.tentativeRect?.(n);
  // `get_size().y` (:117,120) / `get_size().x` (:125,128) — this node's OWN
  // resolved size on the axis it does NOT drive, substituting the texture's
  // own natural size on that axis while unavailable (see this function's
  // own doc for why that substitution is exact on the first pass).
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

// --- stretch_mode: draw rect --------------------------------------------

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
  /** The drawn image's size, Godot pixels — may differ from the control's own rect. */
  size: Vec2;
  /** A texture-PIXEL-space UV crop (KEEP_ASPECT_COVERED only); every other mode samples the whole texture. */
  region?: Rect2;
  /** STRETCH_TILE: the sampler repeats `size` (the natural texture size) across the FULL control rect. */
  tile: boolean;
}

/**
 * `TextureRect::_notification`'s `NOTIFICATION_DRAW` switch on `stretch_mode`
 * (`texture_rect.cpp:45-90`), stopping short of the actual draw call
 * (`:95-99`) and the post-switch flip (`:92-93`, `applyFlip`'s job — flip
 * doesn't change WHAT rect is drawn, only how the sampler reads it).
 * `rectSize` is the control's own solved rect size (Godot's `get_size()` at
 * draw time — genuinely available here, unlike in `textureRectMinimumSize`,
 * since painting happens after Phase 2 assigns every rect).
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

  // Defensive: a zero-dimension texture would divide by zero below. Godot
  // never reaches this code without `texture.is_valid()` (`:36-38`), which
  // implies positive dimensions; this guard only keeps a degenerate input
  // from producing NaN/Infinity geometry.
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
      // `size.width` each falls back to. The OFFSETS below stay fractional —
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

// --- CanvasItem sampler properties ---------------------------------------

const TEXTURE_FILTER_NEAREST = 1;
const TEXTURE_FILTER_LINEAR = 2;
const TEXTURE_FILTER_NEAREST_WITH_MIPMAPS = 3;
const TEXTURE_FILTER_LINEAR_WITH_MIPMAPS = 4;
const TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC = 5;
const TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC = 6;

export type TextureRectFilter = 'nearest' | 'linear';

/**
 * `CanvasItem::TextureFilter` (`scene/main/canvas_item.h:52-60`) → three.js's
 * two magnification/minification filter families. Takes an ALREADY-RESOLVED
 * ordinal: `useInheritedTextureSampler` (`r3f/canvasItemTextureSampler.ts`)
 * walks PARENT_NODE (0) up the Control ancestor chain to the nearest node
 * that names one, leaving `undefined` when none does — which this function's
 * `default` branch maps to `LINEAR`, the class default of the property a
 * parentless CanvasItem's cache ultimately falls back to,
 * `Viewport::default_canvas_item_texture_filter`
 * (`scene/main/viewport.h:419`). The mipmapped and anisotropic variants
 * collapse to their base filter — three.js's anisotropy/mipmap knobs are
 * separate texture properties this mapping doesn't reach for, per the task's
 * own ask (filter → Nearest/LinearFilter).
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
 * `CanvasItem::TextureRepeat` (`scene/main/canvas_item.h:63-69`) → three.js
 * wrap modes. Takes an ALREADY-RESOLVED ordinal, same as `resolveTextureRectFilter`
 * above — `useInheritedTextureSampler` walks PARENT_NODE (0) up the ancestor
 * chain, leaving `undefined` when no ancestor ever names one, which this
 * function's `default` branch maps to `'clamp'`: `Viewport::
 * default_canvas_item_texture_repeat`'s class default, `DISABLED`
 * (`scene/main/viewport.h:420`) — the SAME root default `r3f/spriteFrame.ts`'s
 * `'clamp'` `SpriteWrapMode` already models for the 2D canvas.
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

// --- flip_h / flip_v ------------------------------------------------------

/**
 * `size.width *= hflip ? -1 : 1; size.height *= vflip ? -1 : 1;`
 * (`texture_rect.cpp:92-93`) — Godot mirrors by negating the DESTINATION
 * rect's size, which flips the whole drawn quad (crop region and all) as one
 * unit. Three.js has no negative-size destination quad, so this expresses
 * the identical result as a UV mirror instead: reversing the direction a
 * [0,1] `u`/`v` sweep samples the SAME `repeat`/`offset` window
 * (`newOffset = offset + repeat; newRepeat = -repeat`), composing with
 * whatever `repeat`/`offset` the caller already derived (a crop region, a
 * tile count, or the untouched (1, 1)/(0, 0) identity) rather than resetting
 * it — so it must run LAST, after `stretch_mode`'s own sampler state is
 * computed.
 *
 * With `RepeatWrapping` (STRETCH_TILE), this still matches Godot exactly:
 * the sampler reads `frac(v(u))` for a possibly negative `v`, and GLSL's
 * `fract()` (`x - floor(x)`) is a floor-mod, so `frac(repeat*(1-u))` lands on
 * the identical source texel Godot's own `(rectSize - x) mod textureSize`
 * would — mirroring the WHOLE repeated pattern, never a single tile in
 * isolation. See `nativeSolver.test.ts`'s worked TILE+flip case.
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
