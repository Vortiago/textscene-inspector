/**
 * TextureButton's native (WebGL canvas) rect solver — `TextureButton::
 * get_minimum_size` (`scene/gui/texture_button.cpp:31-52`) and the
 * `stretch_mode` draw-rect math (`TextureButton::_notification`'s
 * `NOTIFICATION_DRAW`, `:120-230`), registered via
 * `controlSolverRegistry.registerMinimumSize`. `Component.tsx` paints;
 * texture selection per draw state also lives here since it is pure data
 * math with no THREE/React dependency.
 *
 * `texture_button.h:39-47`'s `StretchMode` enum shares its 7 values, in the
 * SAME order, with `TextureRect::StretchMode` (`texture_rect.h`) — but the
 * DRAW math is not identical: `TextureRect::_notification`'s KEEP_ASPECT/
 * KEEP_ASPECT_CENTERED branch truncates through `int tex_width`/`tex_height`
 * (`texture_rect.cpp:63-69`), while `TextureButton`'s own branch
 * (`texture_button.cpp:206-219`) is pure `float`, no truncation — so this
 * module ports TextureButton's own switch rather than reusing
 * `texturerect/nativeSolver.ts`'s `textureRectDraw`. The sampler-property
 * mapping and the flip_h/flip_v UV mirror ARE identical (both are plain
 * `CanvasItem` concerns), so `Component.tsx` imports
 * `resolveTextureRectFilter`/`resolveTextureRectRepeat`/`applyFlip` from
 * that slice directly rather than re-deriving them.
 *
 * Pure data + functions, no THREE/React.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { TextureRectDraw } from '../texturerect/nativeSolver';
import type { TextureButtonProperties } from './types';

// --- Draw state + texture selection --------------------------------------------

/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) collapsed to
 * what a pointer-less static preview can ever select — the same collapse
 * every other Button-family slice in this codebase documents: `disabled`
 * wins outright, else `pressing = status.pressed` (== `button_pressed`)
 * unconditionally, `DRAW_HOVER`/`DRAW_HOVER_PRESSED` never fire.
 */
export type TextureButtonDrawState = 'normal' | 'pressed' | 'disabled';

export function resolveTextureButtonDrawState(props: TextureButtonProperties): TextureButtonDrawState {
  if (props.disabled) return 'disabled';
  if (props.buttonPressed) return 'pressed';
  return 'normal';
}

export type TextureButtonSlot = 'textureNormal' | 'texturePressed' | 'textureHover' | 'textureDisabled';

/**
 * `TextureButton::_notification`'s `NOTIFICATION_DRAW` texture cascade
 * (`texture_button.cpp:120-159`, `DRAW_HOVER`/the unreachable branch of
 * `DRAW_HOVER_PRESSED` omitted): `DRAW_NORMAL` shows `texture_normal` with NO
 * further fallback (an empty slot draws nothing); `DRAW_PRESSED` (and
 * `DRAW_HOVER_PRESSED`) falls `texture_pressed` -> `texture_hover` ->
 * `texture_normal`; `DRAW_DISABLED` falls `texture_disabled` ->
 * `texture_normal`. Returns the resolved PROPERTY KEY, not the ref itself —
 * `Component.tsx` already holds all five slots' resolved textures (every
 * `useTexture2D` call is unconditional, hooks cannot branch), so it looks the
 * chosen key up rather than re-deriving which ref string to resolve.
 */
export function resolveTextureButtonSlot(
  props: TextureButtonProperties,
  state: TextureButtonDrawState
): TextureButtonSlot | null {
  if (state === 'disabled') {
    return props.textureDisabled !== undefined ? 'textureDisabled' : 'textureNormal';
  }
  if (state === 'pressed') {
    if (props.texturePressed !== undefined) return 'texturePressed';
    if (props.textureHover !== undefined) return 'textureHover';
    return 'textureNormal';
  }
  return 'textureNormal';
}

// --- Minimum size --------------------------------------------------------------

/**
 * `TextureButton::get_minimum_size` (`texture_button.cpp:31-52`):
 * `texture_normal` -> `texture_pressed` -> `texture_hover` ->
 * `texture_click_mask` -> `(0, 0)`, or unconditionally `(0, 0)` when
 * `ignore_texture_size` is set. `n.textureSize` tracks only ONE texture
 * property per node (`buildSolveTree.ts`'s `resolveTextureSize`, which reads
 * `props.texture ?? props.icon`) — TextureButton has FIVE, and none is named
 * either of those keys, so `n.textureSize` is `null` for every TextureButton
 * node until `buildSolveTree.ts` (orchestrator-owned, outside this slice) is
 * extended to also check `textureNormal`. This function assumes it WILL be,
 * i.e. that `n.textureSize` carries `texture_normal`'s own size (Godot's own
 * first-priority slot) — the `texture_pressed`/`texture_hover`/
 * `texture_click_mask` fallback rungs are not modelled.
 */
export const textureButtonMinimumSize: MinimumSizeFn = (n, _ctx) => {
  const props = n.node.properties as TextureButtonProperties;
  if (props.ignoreTextureSize) return { x: 0, y: 0 };
  if (!n.textureSize) return { x: 0, y: 0 };
  return { x: Math.abs(n.textureSize.x), y: Math.abs(n.textureSize.y) };
};

// --- stretch_mode: draw rect --------------------------------------------------

const STRETCH_SCALE = 0;
const STRETCH_TILE = 1;
const STRETCH_KEEP = 2;
const STRETCH_KEEP_CENTERED = 3;
const STRETCH_KEEP_ASPECT = 4;
const STRETCH_KEEP_ASPECT_CENTERED = 5;
const STRETCH_KEEP_ASPECT_COVERED = 6;

/**
 * `TextureButton::_notification`'s `NOTIFICATION_DRAW` switch on
 * `stretch_mode` (`texture_button.cpp:163-220`), stopping short of the
 * actual draw call and the post-switch flip (`Component.tsx`'s job, via
 * `texturerect/nativeSolver.ts`'s `applyFlip`). `rectSize` is the control's
 * own solved rect size (`get_size()` at draw time).
 *
 * Godot always passes a `_texture_region` to `draw_texture_rect_region` —
 * for every mode but KEEP_ASPECT_COVERED that region is simply the WHOLE
 * natural texture (`Rect2(Point2(), texdraw_size)`, `:159`), which is UV-
 * identical to sampling with no crop at all, so this function leaves
 * `region` `undefined` for those modes (matching `texturerect/nativeSolver.ts`'s
 * own convention) and only computes a real crop rect for KEEP_ASPECT_COVERED.
 */
export function textureButtonDraw(
  rectSize: Vec2,
  textureSize: Vec2,
  stretchMode: number | undefined
): TextureRectDraw {
  const noDraw: TextureRectDraw = { offset: { x: 0, y: 0 }, size: { x: 0, y: 0 }, region: undefined, tile: false };
  if (textureSize.x <= 0 || textureSize.y <= 0) return noDraw;

  switch (stretchMode ?? STRETCH_KEEP) {
    case STRETCH_SCALE:
      return { offset: { x: 0, y: 0 }, size: { x: rectSize.x, y: rectSize.y }, region: undefined, tile: false };

    case STRETCH_TILE:
      return { offset: { x: 0, y: 0 }, size: { x: rectSize.x, y: rectSize.y }, region: undefined, tile: true };

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
      // Pure float, no truncation (`texture_button.cpp:206-219`) — unlike
      // `TextureRect`'s own `int tex_width`/`tex_height` for the same modes.
      let texWidth = (textureSize.x * rectSize.y) / textureSize.y;
      let texHeight = rectSize.y;
      if (texWidth > rectSize.x) {
        texWidth = rectSize.x;
        texHeight = (textureSize.y * texWidth) / textureSize.x;
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
      return { offset: { x: 0, y: 0 }, size: { x: textureSize.x, y: textureSize.y }, region: undefined, tile: false };
  }
}
