/**
 * TextureButton's native (WebGL canvas) rect solver: `TextureButton::get_minimum_size`
 * (`scene/gui/texture_button.cpp:31-52`), the `stretch_mode` draw rect (`NOTIFICATION_DRAW`,
 * `:120-230`) and the texture pick per draw state. Pure data and functions, no THREE or React.
 * The sampler mapping and the flip mirror match TextureRect's, so `Component.tsx` imports them from there.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TscnNode } from '../../../../parser/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn, TextureSlotRequest, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import type { TextureRectDraw } from '../texturerect/nativeSolver';
import type { TextureButtonProperties } from './types';

/** The keys `textureButtonTextureSlots`/`textureButtonMinimumSize` share for `SolveNode.textureSlots`. */
export const TEXTURE_NORMAL_KEY = 'texture_normal';
export const TEXTURE_PRESSED_KEY = 'texture_pressed';
export const TEXTURE_HOVER_KEY = 'texture_hover';

/**
 * The Texture2D slots for `buildSolveTree.ts`: `get_minimum_size`'s three Texture2D reads
 * (`texture_button.cpp:38-55`). `texture_click_mask` is a `BitMap` (`texture_button.h:55`), and
 * `texture_disabled`/`texture_focused` never affect minimum size, so `Component.tsx` resolves them.
 */
export const textureButtonTextureSlots: TextureSlotsFn = (node: TscnNode) => {
  const props = node.properties as TextureButtonProperties;
  const requests: TextureSlotRequest[] = [];
  if (props.textureNormal) requests.push({ key: TEXTURE_NORMAL_KEY, ref: props.textureNormal });
  if (props.texturePressed) requests.push({ key: TEXTURE_PRESSED_KEY, ref: props.texturePressed });
  if (props.textureHover) requests.push({ key: TEXTURE_HOVER_KEY, ref: props.textureHover });
  return requests;
};

/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) as a pointer-less static preview
 * sees it: `disabled` wins, else `pressing = status.pressed` (`button_pressed`), and
 * `DRAW_HOVER`/`DRAW_HOVER_PRESSED` never fire.
 */
export type TextureButtonDrawState = 'normal' | 'pressed' | 'disabled';

export function resolveTextureButtonDrawState(props: TextureButtonProperties): TextureButtonDrawState {
  if (props.disabled) return 'disabled';
  if (props.buttonPressed) return 'pressed';
  return 'normal';
}

export type TextureButtonSlot = 'textureNormal' | 'texturePressed' | 'textureHover' | 'textureDisabled';

/**
 * The `NOTIFICATION_DRAW` texture cascade (`texture_button.cpp:120-159`), less the hover arms.
 * Normal draws `texture_normal` or nothing. Pressed falls `texture_pressed` -> `texture_hover` ->
 * `texture_normal`, and disabled falls `texture_disabled` -> `texture_normal`. It returns the property
 * key, which `Component.tsx` looks up in its already-resolved textures.
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

/**
 * `TextureButton::get_minimum_size` (`texture_button.cpp:31-52`): `texture_normal` ->
 * `texture_pressed` -> `texture_hover` -> `(0, 0)`, or `(0, 0)` under `ignore_texture_size`. The
 * `Ref<BitMap>` click-mask rung is not modelled. A slot not yet loaded falls through like a null
 * `Ref`, and the load bumps `generation` to re-solve.
 */
export const textureButtonMinimumSize: MinimumSizeFn = (n, _ctx) => {
  const props = n.node.properties as TextureButtonProperties;
  if (props.ignoreTextureSize) return { x: 0, y: 0 };
  const size = n.textureSlots[TEXTURE_NORMAL_KEY] ?? n.textureSlots[TEXTURE_PRESSED_KEY] ?? n.textureSlots[TEXTURE_HOVER_KEY];
  if (!size) return { x: 0, y: 0 };
  return { x: Math.abs(size.x), y: Math.abs(size.y) };
};

const STRETCH_SCALE = 0;
const STRETCH_TILE = 1;
const STRETCH_KEEP = 2;
const STRETCH_KEEP_CENTERED = 3;
const STRETCH_KEEP_ASPECT = 4;
const STRETCH_KEEP_ASPECT_CENTERED = 5;
const STRETCH_KEEP_ASPECT_COVERED = 6;

/**
 * The `NOTIFICATION_DRAW` switch on `stretch_mode` (`texture_button.cpp:163-220`), short of the
 * draw call and the flip (`Component.tsx`, `applyFlip`). `rectSize` is `get_size()`. Every mode
 * but KEEP_ASPECT_COVERED draws the whole texture (`Rect2(Point2(), texdraw_size)`, `:159`), so
 * `region` stays `undefined` there, as in `texturerect/nativeSolver.ts`.
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
      // Pure float, no truncation (`texture_button.cpp:206-219`), unlike TextureRect's `int` arms for the
      // same modes (`texture_rect.cpp:63-69`). So this ports its own switch, though `StretchMode`
      // (`texture_button.h:39-47`) matches `TextureRect::StretchMode` (`texture_rect.h`).
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
