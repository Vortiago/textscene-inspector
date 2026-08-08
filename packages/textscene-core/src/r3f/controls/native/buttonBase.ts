/**
 * Shared composite-button logic: draw-state resolution, StyleBox chrome
 * picking/tinting, and the icon/text content-layout math
 * (`Button::_notification`'s `NOTIFICATION_DRAW` and
 * `Button::_fit_icon_size`, `scene/gui/button.cpp`). `Button` (packet P14) is
 * the first consumer; `CheckBox`/`OptionButton` — both `Button` subclasses in
 * Godot itself — reuse this rather than re-deriving it, so this module is
 * deliberately Button-generic: every input is a plain value the caller
 * resolves from its OWN theme/props, nothing here reaches into
 * `ButtonProperties` directly.
 *
 * Pure data + functions, no React, no THREE — matches every other `native/`
 * solver module's convention (painting/composition is the consumer's job).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import { multiplyModulate, type RGBA } from '../../canvasItemModulate';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { FontMetrics } from './text/fontMetrics';
import { AutowrapMode, shapeText, type TextLayoutResult } from './text/textLayout';
export { tintStyleBox } from './StyleBoxQuad';
import type { Rect2, Vec2 } from './rect';

// --- Godot alignment enums (scene/gui/control.h: HorizontalAlignment / VerticalAlignment) ---

export const HORIZONTAL_ALIGNMENT_LEFT = 0;
export const HORIZONTAL_ALIGNMENT_CENTER = 1;
export const HORIZONTAL_ALIGNMENT_RIGHT = 2;

export const VERTICAL_ALIGNMENT_TOP = 0;
export const VERTICAL_ALIGNMENT_CENTER = 1;
export const VERTICAL_ALIGNMENT_BOTTOM = 2;

// --- Draw-state + StyleBox chrome ------------------------------------------

export type ButtonDrawState = 'normal' | 'disabled';

/**
 * `Button::get_draw_mode()` collapses to two cases here: this is a static
 * previewer with no pointer/keyboard input, so `DRAW_HOVER`,
 * `DRAW_HOVER_PRESSED`, `DRAW_PRESSED` and focus-driven colour swaps never
 * occur — only what the scene itself authors via `disabled` can select a
 * non-default state.
 */
export function resolveButtonDrawState(disabled: boolean | undefined): ButtonDrawState {
  return disabled ? 'disabled' : 'normal';
}

/** `overrides[state]` (a resolved `theme_override_styles/<state>`) wins; otherwise the default-theme struct for that same state. */
export function pickButtonStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: Readonly<Record<ButtonDrawState, StyleBoxFlatData>>,
  state: ButtonDrawState
): StyleBoxFlatData {
  return overrides[state] ?? defaults[state];
}


/** The same componentwise multiply as `tintStyleBox`'s two colours, for a single `ControlColor` (font/icon modulate). */
export function tintColor(base: ControlColor, tint: RGBA): ControlColor {
  return multiplyModulate(base, tint);
}

// --- Icon sizing ------------------------------------------------------------

/**
 * `Button::_fit_icon_size` (`button.cpp:469-479`): clamps to `icon_max_width`
 * (theme constant, default `0` — Button's own default theme never sets a
 * clamp, `default_theme.cpp:172`), preserving aspect.
 */
export function fitIconSize(size: Vec2, maxWidth: number): Vec2 {
  if (maxWidth > 0 && size.x > maxWidth) {
    return { x: maxWidth, y: (size.y * maxWidth) / size.x };
  }
  return size;
}

/**
 * Shapes a Button-family label — Button, CheckBox, OptionButton and their
 * solvers all measure the same way, so they call this rather than spelling the
 * option bag out each time.
 *
 * `lineSpacingPx: 0`, not Label's 3: no Button-family control sets a
 * `line_spacing` on its `text_buf` (`button.cpp`, `check_box.cpp`,
 * `option_button.cpp` — none touches the key at all), and a widget whose
 * painter and solver disagree about it comes out with its label centred 3px
 * off rather than failing outright. `boxWidthPx: 0` + `AUTOWRAP_OFF` because
 * a Button never wraps.
 */
export function shapeButtonLabel(
  text: string,
  fontSizePx: number,
  fontMetrics: FontMetrics
): TextLayoutResult {
  return shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx: 0,
    fontMetrics,
  });
}

/**
 * The top edge of vertically-centred text within a Button-family content box,
 * floored — `button.cpp:453`'s `text_ofs.y`, plus Godot's own per-glyph floor.
 *
 * `text_ofs.y` itself is never floored in the source; the floor happens
 * per-glyph, deep in the TextServer, once this offset has already been baked
 * into the drawn baseline (`modules/text_server_adv/text_server_adv.cpp:4083`,
 * `TextServerAdvanced::_font_draw_glyph`: `cpos.y = Math::floor(cpos.y);`,
 * where `cpos` is `p_pos` = this `text_ofs.y` + the line's ascent). Since this
 * codebase's ascent (`getFontAscentPx`) is always a whole pixel already,
 * `floor(text_ofs.y) + ascent === floor(text_ofs.y + ascent)`, so flooring
 * HERE — before ascent is even added, in `<TextRun>`'s own per-line math —
 * reaches the identical pixel the source does.
 *
 * Left unfloored, a box-height/text-height pairing whose difference is odd
 * (a 32px rect with 16px SemiBold text at 23px tall: `(24-23)/2 = 0.5`) lands
 * the glyph's baseline exactly ON a pixel boundary, which this engine's WebGL
 * rasteriser resolves upward instead of down — a full row above Godot's floor,
 * on every affected Button-family label.
 */
export function centredTextTopPx(
  boxHeightPx: number,
  textHeightPx: number,
  topInsetPx: number
): number {
  return Math.floor((boxHeightPx - textHeightPx) / 2 + topInsetPx);
}

// --- Content layout: icon + text placement within a Button-family control --

export interface ButtonContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** The CURRENT draw-state StyleBox's content margins (`style->get_margin(SIDE_*)`). */
  styleMargin: { left: number; top: number; right: number; bottom: number };
  /** `h_separation` theme constant — clamped to >= 0 internally, matching `MAX(0, theme_cache.h_separation)`. */
  hSeparation: number;
  /** `icon_max_width` theme constant; `0` (the default) means unclamped. */
  iconMaxWidth: number;
  /** Text `alignment` (`HorizontalAlignment`). */
  textAlignment: number;
  /** `icon_alignment` (`HorizontalAlignment`). */
  iconAlignment: number;
  /** `vertical_icon_alignment` (`VerticalAlignment`). */
  verticalIconAlignment: number;
  expandIcon: boolean;
  /** The icon's OWN natural pixel size, or `null` when no icon is present/loaded yet. */
  iconNaturalSize: Vec2 | null;
  hasText: boolean;
  /** The shaped text's own natural (unwrapped) size — `(0, 0)` when `hasText` is false. */
  textNaturalSize: Vec2;
}

export interface ButtonIconLayout {
  /** LOCAL to the control's own top-left, Godot px. */
  rect: Rect2;
}

export interface ButtonTextLayout {
  /** The text paragraph's own box top-left, LOCAL Godot px — feed straight to `<TextRun>`, which anchors each line at its own baseline from there (`buildGlyphQuadArrays`'s own doc). */
  offset: Vec2;
}

export interface ButtonContentLayout {
  icon: ButtonIconLayout | null;
  text: ButtonTextLayout | null;
}

const H_CENTER = HORIZONTAL_ALIGNMENT_CENTER;
const H_LEFT = HORIZONTAL_ALIGNMENT_LEFT;
const H_RIGHT = HORIZONTAL_ALIGNMENT_RIGHT;
const V_CENTER = VERTICAL_ALIGNMENT_CENTER;
const V_TOP = VERTICAL_ALIGNMENT_TOP;
const V_BOTTOM = VERTICAL_ALIGNMENT_BOTTOM;

/**
 * `Button::_notification`'s `NOTIFICATION_DRAW` icon/text placement
 * (`button.cpp:233-456`). RTL and `clip_text`/`overrun_behavior`/
 * `autowrap_mode` are out of scope — this codebase never models layout
 * direction, and `ButtonProperties` parses none of the three text-fitting
 * properties, so every RTL/clip branch in the source collapses to its
 * non-RTL, non-clipped case.
 *
 * Godot's OWN `text_ofs.x`/`text_ofs.y` there are the shaped paragraph's BOX
 * top-left, with the REAL horizontal alignment (`text_buf->set_alignment`)
 * applied internally by the TextServer paragraph when it draws — this engine
 * has no equivalent (`<TextRun>` draws a shaped layout literally, at its own
 * pen positions, with no box/alignment concept of its own). So the
 * horizontal alignment shift Godot's TextServer performs internally is
 * folded into this function's returned offset instead — the same
 * "flatten the box-plus-internal-alignment into one external offset"
 * approach `nodes/2d/ui/label/nativeSolver.ts`'s `layoutLabelLines` already
 * established for Label's own per-line placement.
 */
export function layoutButtonContent(input: ButtonContentInput): ButtonContentLayout {
  const {
    rectSize,
    styleMargin,
    hSeparation: hSeparationRaw,
    iconMaxWidth,
    textAlignment,
    iconAlignment,
    verticalIconAlignment,
    expandIcon,
    iconNaturalSize,
    hasText,
    textNaturalSize,
  } = input;
  const hSeparation = Math.max(0, hSeparationRaw);

  // Button itself never sets `_internal_margin` (that is an OptionButton/
  // CheckBox concern, out of this packet's scope), so the box after
  // stylebox margins is the full "custom element size" with no further inset.
  const customElementSize: Vec2 = {
    x: rectSize.x - styleMargin.left - styleMargin.right,
    y: rectSize.y - styleMargin.top - styleMargin.bottom,
  };

  let drawableWidth = customElementSize.x;
  let drawableHeight = customElementSize.y;

  let iconSize: Vec2 | null = null;
  if (iconNaturalSize && iconNaturalSize.x > 0 && iconNaturalSize.y > 0) {
    let size: Vec2 = iconNaturalSize;
    if (expandIcon) {
      let w = customElementSize.x;
      let h = customElementSize.y;
      if (iconAlignment !== H_CENTER && textNaturalSize.x > 0) {
        w -= textNaturalSize.x + hSeparation;
      }
      if (verticalIconAlignment !== V_CENTER) {
        h -= textNaturalSize.y;
      }
      let iw = (size.x * h) / size.y;
      let ih = h;
      if (iw > w) {
        iw = w;
        ih = (size.y * iw) / size.x;
      }
      size = { x: iw, y: ih };
    }
    size = fitIconSize(size, iconMaxWidth);
    size = { x: Math.round(size.x), y: Math.round(size.y) };
    if (size.x > 0) iconSize = size;
  }

  let iconLayout: ButtonIconLayout | null = null;
  if (iconSize) {
    let iconX: number;
    switch (iconAlignment) {
      case H_CENTER:
        iconX = styleMargin.left + (customElementSize.x - iconSize.x) / 2;
        break;
      case H_RIGHT:
        iconX = rectSize.x - styleMargin.right - iconSize.x;
        break;
      case H_LEFT:
      default:
        iconX = styleMargin.left;
        break;
    }
    let iconY: number;
    switch (verticalIconAlignment) {
      case V_CENTER:
        iconY = styleMargin.top + (customElementSize.y - iconSize.y) / 2;
        break;
      case V_BOTTOM:
        iconY = rectSize.y - styleMargin.bottom - iconSize.y;
        break;
      case V_TOP:
      default:
        iconY = styleMargin.top;
        break;
    }

    // The space reserved for the icon (+ separation, when it sits beside
    // rather than behind the text) only affects TEXT layout when there IS
    // text to lay out — matching `if (!xl_text.is_empty())`'s gate in the
    // source around this same subtraction.
    if (hasText) {
      if (iconAlignment !== H_CENTER) drawableWidth -= iconSize.x + hSeparation;
      if (verticalIconAlignment !== V_CENTER) drawableHeight -= iconSize.y;
    }

    iconLayout = { rect: { x: Math.floor(iconX), y: Math.floor(iconY), w: iconSize.x, h: iconSize.y } };
  }

  let textLayout: ButtonTextLayout | null = null;
  if (hasText) {
    let textOffsetX = styleMargin.left;
    if (iconLayout && iconAlignment === H_LEFT) {
      // Only a LEFT icon pushes text right past it; a RIGHT or CENTER icon's
      // reservation already narrowed `drawableWidth`, and the alignment
      // shift below operates within that narrower box directly.
      textOffsetX += customElementSize.x - drawableWidth;
    }
    textOffsetX += horizontalAlignShift(textNaturalSize.x, drawableWidth, textAlignment);

    let textOffsetY = centredTextTopPx(drawableHeight, textNaturalSize.y, styleMargin.top);
    if (iconLayout && verticalIconAlignment === V_TOP) {
      textOffsetY += customElementSize.y - drawableHeight;
    }
    textLayout = { offset: { x: textOffsetX, y: textOffsetY } };
  }

  return { icon: iconLayout, text: textLayout };
}

function horizontalAlignShift(contentWidthPx: number, boxWidthPx: number, alignment: number): number {
  switch (alignment) {
    case H_CENTER:
      return (boxWidthPx - contentWidthPx) / 2;
    case H_RIGHT:
      return boxWidthPx - contentWidthPx;
    case H_LEFT:
    default:
      return 0;
  }
}
