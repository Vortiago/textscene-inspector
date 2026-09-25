/**
 * Button-family logic shared by Button and its subclasses: draw state, StyleBox
 * choice, and icon and text layout (`Button::_notification` and
 * `Button::_fit_icon_size`, `scene/gui/button.cpp`). Every input is a plain value
 * the caller resolves from its own theme and props. No React, no THREE.
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
 * `Button::get_draw_mode()` with no pointer or keyboard input: hover, pressed and
 * focus states never occur, so only an authored `disabled` leaves `normal`.
 */
export function resolveButtonDrawState(disabled: boolean | undefined): ButtonDrawState {
  return disabled ? 'disabled' : 'normal';
}

/**
 * A `theme_override_styles/<state>` wins over the default. Under `rtl`,
 * `<state>_mirrored` comes first (`button.cpp:100-148`). The default theme's only
 * mirrored boxes, OptionButton's, equal their plain siblings
 * (`default_theme.cpp:215-233`), so `defaults` has no mirrored twin.
 */
export function pickButtonStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: Readonly<Record<ButtonDrawState, StyleBoxFlatData>>,
  state: ButtonDrawState,
  rtl = false
): StyleBoxFlatData {
  if (rtl) {
    const mirrored = overrides[`${state}_mirrored`];
    if (mirrored) return mirrored;
  }
  return overrides[state] ?? defaults[state];
}


/** The same componentwise multiply as `tintStyleBox`'s two colours, for a single `ControlColor` (font/icon modulate). */
export function tintColor(base: ControlColor, tint: RGBA): ControlColor {
  return multiplyModulate(base, tint);
}

// --- Icon sizing ------------------------------------------------------------

/**
 * `Button::_fit_icon_size` (`button.cpp:469-479`): clamps to `icon_max_width`,
 * keeping aspect. The default theme sets 0, no clamp (`default_theme.cpp:172`).
 */
export function fitIconSize(size: Vec2, maxWidth: number): Vec2 {
  if (maxWidth > 0 && size.x > maxWidth) {
    return { x: maxWidth, y: (size.y * maxWidth) / size.x };
  }
  return size;
}

/**
 * Shapes a Button-family label, the one measure its painters and solvers share.
 * @param boxWidthPx The width `Button::_notification` shapes at
 *   (`button.cpp:428-432`), `Math::ceil(MAX(1.0f, drawable_size_remained.width))`.
 *   A caller that does not wrap omits the last three.
 * @param autowrapTrimFlags `autowrap_flags_trim`, ORed onto the break flags at `:560`.
 *   Undefined keeps the class default, both edge-space trims.
 */
export function shapeButtonLabel(
  text: string,
  fontSizePx: number,
  fontMetrics: FontMetrics,
  boxWidthPx = 0,
  autowrapMode: AutowrapMode = AutowrapMode.OFF,
  autowrapTrimFlags?: number
): TextLayoutResult {
  return shapeText(text, {
    fontSizePx,
    boxWidthPx,
    autowrapMode,
    // Not Label's 3: no Button-family control sets `line_spacing` on its `text_buf`
    // (`button.cpp`, `check_box.cpp`, `option_button.cpp`).
    lineSpacingPx: 0,
    fontMetrics,
    autowrapTrimFlags,
  });
}

/**
 * `button.cpp:453`'s `text_ofs.y`, floored here for the per-glyph
 * `cpos.y = Math::floor(cpos.y)` (`modules/text_server_adv/text_server_adv.cpp:4083`).
 * The ascent is a whole pixel, so the floor moves ahead of it. Unfloored, a half
 * pixel lands on a boundary WebGL resolves upward, a row above Godot.
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
  /** The current draw-state StyleBox's content margins (`style->get_margin(SIDE_*)`). */
  styleMargin: { left: number; top: number; right: number; bottom: number };
  /** `h_separation` theme constant, clamped to >= 0 like `MAX(0, theme_cache.h_separation)`. */
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
  /** The icon's natural pixel size, or `null` while no icon is present or loaded. */
  iconNaturalSize: Vec2 | null;
  hasText: boolean;
  /** The shaped text's unwrapped size, `(0, 0)` when `hasText` is false. */
  textNaturalSize: Vec2;
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`): swaps the icon and text alignment sides. */
  rtl: boolean;
}

export interface ButtonIconLayout {
  /** Local to the control's top-left, Godot px. */
  rect: Rect2;
}

export interface ButtonTextLayout {
  /** The paragraph box's top-left, local Godot px, for `<TextRun>` to anchor each line's baseline from. */
  offset: Vec2;
}

export interface ButtonContentLayout {
  icon: ButtonIconLayout | null;
  text: ButtonTextLayout | null;
  /** `drawable_size_remained` (`button.cpp:332-352,428`): the label's box after margins and the icon. A wrapping label re-shapes at `Math::ceil(MAX(1, drawableSize.x))`. */
  drawableSize: Vec2;
}

const H_CENTER = HORIZONTAL_ALIGNMENT_CENTER;
const H_LEFT = HORIZONTAL_ALIGNMENT_LEFT;
const H_RIGHT = HORIZONTAL_ALIGNMENT_RIGHT;
const V_CENTER = VERTICAL_ALIGNMENT_CENTER;
const V_TOP = VERTICAL_ALIGNMENT_TOP;
const V_BOTTOM = VERTICAL_ALIGNMENT_BOTTOM;

/**
 * `Button::_notification`'s icon and text placement (`button.cpp:233-456`), with
 * every clip branch at its non-clipped case: sizing reads `clip_text` and the rest.
 * `<TextRun>` has no alignment, so the TextServer's shift (`text_buf->set_alignment`)
 * folds into the text offset, as `layoutLabelLines` does for Label.
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
    rtl,
  } = input;
  const hSeparation = Math.max(0, hSeparationRaw);
  // `button.cpp:262-276`: swapped once, and CENTER never moves. The paragraph
  // direction (`:565`) is bidi this shaper does not model, nor the RTL right-hug
  // of an overflowing CENTER line (`text_paragraph.cpp:908`).
  const iconAlign = rtl ? swapAlignmentSide(iconAlignment) : iconAlignment;
  const textAlign = rtl ? swapAlignmentSide(textAlignment) : textAlignment;

  // Button never sets `_internal_margin`, so the box inside the stylebox margins
  // is the whole custom element size.
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
      if (iconAlign !== H_CENTER && textNaturalSize.x > 0) {
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
    switch (iconAlign) {
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

    // The icon's reservation narrows the text box only when there is text, as
    // `if (!xl_text.is_empty())` gates it.
    if (hasText) {
      if (iconAlign !== H_CENTER) drawableWidth -= iconSize.x + hSeparation;
      if (verticalIconAlignment !== V_CENTER) drawableHeight -= iconSize.y;
    }

    iconLayout = { rect: { x: Math.floor(iconX), y: Math.floor(iconY), w: iconSize.x, h: iconSize.y } };
  }

  let textLayout: ButtonTextLayout | null = null;
  if (hasText) {
    let textOffsetX = styleMargin.left;
    if (iconLayout && iconAlign === H_LEFT) {
      // Only a LEFT icon pushes the text right. A RIGHT or CENTER icon has
      // already narrowed `drawableWidth`.
      textOffsetX += customElementSize.x - drawableWidth;
    }
    textOffsetX += buttonTextAlignShiftPx(textNaturalSize.x, drawableWidth, textAlign);

    let textOffsetY = centredTextTopPx(drawableHeight, textNaturalSize.y, styleMargin.top);
    if (iconLayout && verticalIconAlignment === V_TOP) {
      textOffsetY += customElementSize.y - drawableHeight;
    }
    textLayout = { offset: { x: textOffsetX, y: textOffsetY } };
  }

  return { icon: iconLayout, text: textLayout, drawableSize: { x: drawableWidth, y: drawableHeight } };
}

/** `button.cpp:266-275`: LEFT and RIGHT trade places under RTL, and any other value stays. */
export function swapAlignmentSide(alignment: number): number {
  if (alignment === H_RIGHT) return H_LEFT;
  if (alignment === H_LEFT) return H_RIGHT;
  return alignment;
}

/**
 * A Button-family label's shift in its drawable box: `button.cpp:437-441`, then
 * `TextParagraph::draw`'s alignment (`text_paragraph.cpp:887-922`). Every arm
 * measures against the ceiled paragraph width (`:437`), not the drawable width.
 * @param contentWidthPx `shaped_text_get_width`, ceiled (`text_server_adv.cpp:7561-7570`).
 */
export function buttonTextAlignShiftPx(
  contentWidthPx: number,
  drawableWidthPx: number,
  alignment: number
): number {
  const textBufWidthPx = Math.ceil(Math.max(1, drawableWidthPx));
  switch (alignment) {
    case H_CENTER: {
      // The ceiling's leftover (`:439`), then a floored half
      // (`text_paragraph.cpp:904`). An overflowing line (`:902`) right-hugs only
      // an inferred RTL direction, which this shaper never produces.
      const boxOffsetPx = (drawableWidthPx - textBufWidthPx) / 2;
      if (contentWidthPx > textBufWidthPx) return boxOffsetPx;
      return boxOffsetPx + Math.floor((textBufWidthPx - contentWidthPx) / 2);
    }
    case H_RIGHT:
      return textBufWidthPx - contentWidthPx;
    case H_LEFT:
    default:
      return 0;
  }
}
