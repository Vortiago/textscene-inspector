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

import { multiplyModulate } from '../../canvasItemModulate';
import type { SolveNode } from './solveTree';
import type { TextureSlotRequest } from './solverRegistry';
import type { TextThemeKeys } from './textTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { FontMetrics } from './text/fontMetrics';
import { drawnLinesInBox, textParagraphLineShiftPx } from './text/lineDrawClip';
import {
  BREAK_TRIM_END_EDGE_SPACES,
  clampAutowrapMode,
  infersRtl,
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
  type TextLineLayout,
} from './text/textLayout';
import {
  isTextWidthClipped,
  overrunFlagsForBehavior,
  trimLayoutToWidth,
  type TextBufferTrimOptions,
  type TextClipProperties,
} from './text/textOverrun';
import type { TextBidiOptions } from './text/textBidiOptions';
import type { Rect2 } from '../../../godot/math/rect2';
import { type Rgba } from '../../../godot/math/math';
import { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import type { Vector2 } from '../../../godot/math/vector';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

// --- Draw-state + StyleBox chrome ------------------------------------------

/** A Button's draw mode: `DRAW_PRESSED` is a toggle that is on (`base_button.cpp:352`). */
export type ToggleDrawState = 'normal' | 'disabled' | 'pressed';

/** `BaseButton::get_draw_mode()` with no pointer: a disabled button wins over a toggle that is on (`base_button.cpp:326-328`). */
export function resolveToggleDrawState(
  disabled: boolean | undefined,
  isPressed: boolean | undefined
): ToggleDrawState {
  if (disabled) return 'disabled';
  return isPressed ? 'pressed' : 'normal';
}

/**
 * A `theme_override_styles/<state>` wins over the default. Under `rtl`,
 * `<state>_mirrored` comes first (`button.cpp:100-148`). The default theme's only
 * mirrored boxes, OptionButton's, equal their plain siblings
 * (`default_theme.cpp:215-233`), so `defaults` has no mirrored twin.
 */
export function pickButtonStyleBox<State extends string>(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: Readonly<Record<State, StyleBoxFlatData>>,
  state: State,
  rtl = false
): StyleBoxFlatData {
  if (rtl) {
    const mirrored = overrides[`${state}_mirrored`];
    if (mirrored) return mirrored;
  }
  return overrides[state] ?? defaults[state];
}

/** The boxes `Button::_update_style_margins` always measures (`button.cpp:66,75-90`). `hover_pressed` joins only where a theme sets it. */
const MEASURED_BOX_NAMES = ['normal', 'pressed', 'hover', 'disabled'] as const;

type MeasuredBoxName = (typeof MEASURED_BOX_NAMES)[number];

/**
 * `Button::_update_style_margins` (`button.cpp:52-95`): the largest content margin of each side over the
 * boxes of every draw mode. `align_to_largest_stylebox` lays the button out in them, and a subclass takes
 * their sum as the padding around what it reserves (`_get_largest_stylebox_size`, `check_box.cpp:68`).
 * The default theme gives `hover_pressed` only to CheckBox and CheckButton, as their one empty box
 * (`default_theme.cpp:283,322`), so only a scene's own `hover_pressed` can change the answer.
 */
export function largestStyleBoxMargins(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: Readonly<Record<MeasuredBoxName, StyleBoxFlatData>>,
  rtl: boolean
): StyleBoxFlatData['contentMargin'] {
  const boxes = MEASURED_BOX_NAMES.map((name) => pickButtonStyleBox(overrides, defaults, name, rtl));
  const hoverPressed = (rtl ? overrides.hover_pressed_mirrored : undefined) ?? overrides.hover_pressed;
  if (hoverPressed) boxes.push(hoverPressed);
  const largest = { left: 0, top: 0, right: 0, bottom: 0 };
  for (const { contentMargin } of boxes) {
    largest.left = Math.max(largest.left, contentMargin.left);
    largest.top = Math.max(largest.top, contentMargin.top);
    largest.right = Math.max(largest.right, contentMargin.right);
    largest.bottom = Math.max(largest.bottom, contentMargin.bottom);
  }
  return largest;
}

/** The same componentwise multiply `<StyleBoxQuad>` applies to a StyleBox's two colours, for a single `Rgba` (font/icon modulate). */
export function tintColor(base: Rgba, tint: Rgba): Rgba {
  return multiplyModulate(base, tint);
}

// --- Icon sizing ------------------------------------------------------------

/**
 * `Button::_fit_icon_size` (`button.cpp:469-479`): clamps to `icon_max_width`,
 * keeping aspect. The default theme sets 0, no clamp (`default_theme.cpp:172`).
 */
export function fitIconSize(size: Vector2, maxWidth: number): Vector2 {
  if (maxWidth > 0 && size.x > maxWidth) {
    return { x: maxWidth, y: (size.y * maxWidth) / size.x };
  }
  return size;
}

/** What a Button-family label shapes with, beyond its text. */
interface ButtonLabelShapeOptions {
  fontSizePx: number;
  fontMetrics: FontMetrics;
  /** The paragraph's direction, language and override ranges (`button.cpp:564-569`). Undefined shapes at AUTO in the root locale. */
  bidi?: TextBidiOptions;
  /**
   * The width `Button::_notification` shapes at (`button.cpp:428-432`),
   * `Math::ceil(MAX(1.0f, drawable_size_remained.width))`. A caller that does not wrap omits it and the
   * two below.
   */
  boxWidthPx?: number;
  autowrapMode?: EnumValue<typeof AutowrapMode>;
  /** `autowrap_flags_trim`, ORed onto the break flags at `:560`. Undefined trims both edge spaces, Label's default: `shapeWrappedButtonLabel` passes Button's own. */
  autowrapTrimFlags?: number;
}

/** Shapes a Button-family label, the one measure its painters and solvers share. */
export function shapeButtonLabel(text: string, options: ButtonLabelShapeOptions): TextLayoutResult {
  const {
    fontSizePx,
    fontMetrics,
    bidi,
    boxWidthPx = 0,
    autowrapMode = AutowrapMode.AUTOWRAP_OFF,
    autowrapTrimFlags,
  } = options;
  return shapeText(text, {
    fontSizePx,
    boxWidthPx,
    autowrapMode,
    // Not Label's 3: no Button-family control sets `line_spacing` on its `text_buf`
    // (`button.cpp`, `check_box.cpp`, `option_button.cpp`).
    lineSpacingPx: 0,
    // `TextParagraph` shapes no end glyph, which would add a blank row after a glyph wider than the box.
    hasEndGlyph: false,
    fontMetrics,
    autowrapTrimFlags,
    ...bidi,
  });
}

/** `Button::autowrap_flags_trim` default (`button.h:48`): end spaces only, where Label also trims start spaces. */
const BUTTON_DEFAULT_TRIM_FLAGS = BREAK_TRIM_END_EDGE_SPACES;

/** The properties `Button::_shape` and `get_minimum_size_for_text_and_icon` read to wrap a label (`button.cpp:493,546-561`). */
export interface ButtonWrapProperties {
  autowrapMode?: number;
  autowrapTrimFlags?: number;
}

/** Whether `props` wraps the label at its box. An out-of-range mode is OFF, as `set_autowrap_mode` leaves it. */
export function isButtonAutowrapped(props: ButtonWrapProperties): boolean {
  return clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF) !== AutowrapMode.AUTOWRAP_OFF;
}

/** Whether a Button-family node wraps its label, so its minimum size reads the node's own width. */
export function isButtonNodeAutowrapped(n: SolveNode): boolean {
  return isButtonAutowrapped(n.node.properties as ButtonWrapProperties);
}

/**
 * The one step that shapes a Button-family label for its `autowrap_mode`: Button, CheckBox, CheckButton,
 * MenuButton and OptionButton call it. `options.boxWidthPx` is the width the label wraps at
 * ({@link buttonTextBufWidthPx}); it is ignored at AUTOWRAP_OFF.
 */
export function shapeWrappedButtonLabel(
  text: string,
  props: ButtonWrapProperties,
  options: Omit<ButtonLabelShapeOptions, 'autowrapMode' | 'autowrapTrimFlags'>
): TextLayoutResult {
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF);
  return shapeButtonLabel(text, {
    ...options,
    boxWidthPx: autowrapMode === AutowrapMode.AUTOWRAP_OFF ? 0 : options.boxWidthPx,
    autowrapMode,
    autowrapTrimFlags: props.autowrapTrimFlags ?? BUTTON_DEFAULT_TRIM_FLAGS,
  });
}

/**
 * `button.cpp:453`'s `text_ofs.y`, floored here for the per-glyph
 * `cpos.y = Math::floor(cpos.y)` (`modules/text_server_adv/text_server_adv.cpp:4083`).
 * The ascent is a whole pixel, so the floor moves ahead of it. Unfloored, a half
 * pixel lands on a boundary WebGL resolves upward, a row above Godot.
 */
function centredTextTopPx(boxHeightPx: number, textHeightPx: number, topInsetPx: number): number {
  return Math.floor((boxHeightPx - textHeightPx) / 2 + topInsetPx);
}

// --- Content layout: icon + text placement within a Button-family control --

export interface ButtonContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vector2;
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
  iconNaturalSize: Vector2 | null;
  hasText: boolean;
  /** The shaped text's unwrapped size, `(0, 0)` when `hasText` is false. */
  textNaturalSize: Vector2;
  /** Whether the shaped text infers RTL (`shaped_text_get_inferred_direction`): an overflowing CENTER line then ends at the trailing edge. */
  isTextRtl: boolean;
  /** `clip_text`, a trimming overrun or autowrap (`button.cpp:332`): an expanded icon then keeps the text's width (`:345`). */
  isClipped: boolean;
  /** `_internal_margin` (`button.cpp:247-259`): the width a derived class reserves on each side for its own element, before its `h_separation`. A Button reserves none (absent). */
  internalMargin?: { left: number; right: number };
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`): swaps the icon and text alignment sides. */
  rtl: boolean;
}

/** What `layoutButtonContent` reads of the node, before the shaped label's own size and direction. */
export type ButtonContentFacts = Omit<ButtonContentInput, 'textNaturalSize' | 'isTextRtl'>;

/** `_set_internal_margin` of one side (`check_box.cpp:96-101`, `check_button.cpp:96-104`): the other stays zero. */
export function internalMarginAt(side: 'left' | 'right', px: number): { left: number; right: number } {
  return side === 'left' ? { left: px, right: 0 } : { left: 0, right: px };
}

interface ButtonIconLayout {
  /** Local to the control's top-left, Godot px. */
  rect: Rect2;
}

interface ButtonTextLayout {
  /** The widest line's top-left, local Godot px. MenuButton and TabBar place their single line from it. Button reads only its `y`. */
  offset: Vector2;
  /** The paragraph box's left edge before alignment: the margin, the left reservation and a LEFT icon's push. `buttonDrawnLabel` offsets lines from it. */
  boxLeftPx: number;
}

/** The paragraph box a Button-family label draws in, local to the control, Godot px. */
export interface ButtonLabelBox {
  /** The box's left edge before alignment: the margins and whatever the icon or the check reserves. */
  leftPx: number;
  /** The first line's top. */
  topPx: number;
  /** `drawable_size_remained.width` (`button.cpp:428`), before the ceiling. */
  widthPx: number;
  /** `align_rtl_checked`, the alignment after the RTL side swap (`button.cpp:271-275`). */
  alignment: number;
}

export interface ButtonContentLayout {
  /** The icon to draw, `null` for no icon or an `expand_icon` one with no room left. */
  icon: ButtonIconLayout | null;
  /**
   * The icon's size as `button.cpp:349-405` takes it off the label's box, where there is text and the
   * icon is not centred on that axis. It is negative when `expand_icon` leaves no room: `icon` is then `null`.
   */
  iconReserve: Vector2 | null;
  text: ButtonTextLayout | null;
  /** The label's paragraph box, `null` without text. `<ButtonLabel>` draws the label in it. */
  labelBox: ButtonLabelBox | null;
  /** `drawable_size_remained` (`button.cpp:332-352,428`): the label's box after margins and the icon. A wrapping label re-shapes at `Math::ceil(MAX(1, drawableSize.x))`. */
  drawableSize: Vector2;
}

/** `button.cpp:247-259`: a reservation brings its `h_separation` only when it is above zero. */
function reservedWithSeparationPx(reservedPx: number, hSeparation: number): number {
  return reservedPx > 0 ? reservedPx + hSeparation : reservedPx;
}

const {
  HORIZONTAL_ALIGNMENT_CENTER: H_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT: H_LEFT,
  HORIZONTAL_ALIGNMENT_RIGHT: H_RIGHT,
} = HorizontalAlignment;
const {
  VERTICAL_ALIGNMENT_CENTER: V_CENTER,
  VERTICAL_ALIGNMENT_TOP: V_TOP,
  VERTICAL_ALIGNMENT_BOTTOM: V_BOTTOM,
} = VerticalAlignment;

/**
 * `Button::_notification`'s icon and text placement (`button.cpp:233-456`). `isClipped` is its one
 * clip branch (`:345`); sizing reads `clip_text` and the rest.
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
    isTextRtl,
    isClipped,
    internalMargin = { left: 0, right: 0 },
    rtl,
  } = input;
  const hSeparation = Math.max(0, hSeparationRaw);
  const leftReservedPx = reservedWithSeparationPx(internalMargin.left, hSeparation);
  const rightReservedPx = reservedWithSeparationPx(internalMargin.right, hSeparation);
  // `button.cpp:262-276`: swapped once, and CENTER never moves. The paragraph
  // direction (`:565`) is bidi this shaper does not model, nor the RTL right-hug
  // of an overflowing CENTER line (`text_paragraph.cpp:908`).
  const iconAlign = rtl ? swapAlignmentSide(iconAlignment) : iconAlignment;
  const textAlign = rtl ? swapAlignmentSide(textAlignment) : textAlignment;

  // The box inside the stylebox margins and the reservations: `custom_element_size` (`button.cpp:333`).
  const customElementSize: Vector2 = {
    x: rectSize.x - styleMargin.left - styleMargin.right - leftReservedPx - rightReservedPx,
    y: rectSize.y - styleMargin.top - styleMargin.bottom,
  };

  let drawableWidth = customElementSize.x;
  let drawableHeight = customElementSize.y;

  let iconSize: Vector2 | null = null;
  if (iconNaturalSize && iconNaturalSize.x > 0 && iconNaturalSize.y > 0) {
    let size: Vector2 = iconNaturalSize;
    if (expandIcon) {
      let w = customElementSize.x;
      let h = customElementSize.y;
      if (!isClipped && iconAlign !== H_CENTER && textNaturalSize.x > 0) {
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
    iconSize = size;
  }

  let iconLayout: ButtonIconLayout | null = null;
  if (iconSize) {
    let iconX: number;
    switch (iconAlign) {
      case H_CENTER:
        iconX = styleMargin.left + leftReservedPx + (customElementSize.x - iconSize.x) / 2;
        break;
      case H_RIGHT:
        iconX = rectSize.x - styleMargin.right - rightReservedPx - iconSize.x;
        break;
      case H_LEFT:
      default:
        iconX = styleMargin.left + leftReservedPx;
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

    // A zero or negative width draws nothing, but `drawableWidth` and the text offsets above keep its size.
    if (iconSize.x > 0) {
      iconLayout = {
        rect: { x: Math.floor(iconX), y: Math.floor(iconY), w: iconSize.x, h: iconSize.y },
      };
    }
  }

  let textLayout: ButtonTextLayout | null = null;
  if (hasText) {
    let boxLeftPx = styleMargin.left + leftReservedPx;
    if (iconSize && iconAlign === H_LEFT) {
      // Only a LEFT icon pushes the text right. A RIGHT or CENTER icon has
      // already narrowed `drawableWidth`.
      boxLeftPx += customElementSize.x - drawableWidth;
    }
    const textOffsetX =
      boxLeftPx + buttonTextAlignShiftPx(textNaturalSize.x, drawableWidth, textAlign, isTextRtl);

    let textOffsetY = centredTextTopPx(drawableHeight, textNaturalSize.y, styleMargin.top);
    if (iconSize && verticalIconAlignment === V_TOP) {
      textOffsetY += customElementSize.y - drawableHeight;
    }
    textLayout = { offset: { x: textOffsetX, y: textOffsetY }, boxLeftPx };
  }

  const labelBox = textLayout && {
    leftPx: textLayout.boxLeftPx,
    topPx: textLayout.offset.y,
    widthPx: drawableWidth,
    alignment: textAlign,
  };
  return {
    icon: iconLayout,
    iconReserve: iconSize,
    text: textLayout,
    labelBox,
    drawableSize: { x: drawableWidth, y: drawableHeight },
  };
}

/**
 * The icon rect of a Button with an icon and no text, at `iconAlignment` (LEFT is the default, swapped
 * to the trailing edge in an RTL layout) and the default `vertical_icon_alignment` (CENTER), local to the
 * button. Null for an empty icon.
 */
function iconOnlyButtonIconRect(
  rectSize: Vector2,
  styleMargin: ButtonContentInput['styleMargin'],
  iconSize: Vector2,
  rtl: boolean,
  iconAlignment: number = H_LEFT
): Rect2 | null {
  const { icon } = layoutButtonContent({
    rectSize,
    styleMargin,
    hSeparation: 0,
    iconMaxWidth: 0,
    textAlignment: H_CENTER,
    iconAlignment,
    verticalIconAlignment: V_CENTER,
    expandIcon: false,
    iconNaturalSize: iconSize,
    hasText: false,
    textNaturalSize: { x: 0, y: 0 },
    isTextRtl: false,
    isClipped: false,
    rtl,
  });
  return icon?.rect ?? null;
}

/** `iconOnlyButtonIconRect` for a button at `box`, in the coordinates `box` is in. */
export function iconOnlyButtonIconRectIn(
  box: Rect2,
  styleMargin: ButtonContentInput['styleMargin'],
  iconSize: Vector2,
  rtl: boolean,
  iconAlignment?: number
): Rect2 | null {
  const local = iconOnlyButtonIconRect({ x: box.w, y: box.h }, styleMargin, iconSize, rtl, iconAlignment);
  return local && { ...local, x: box.x + local.x, y: box.y + local.y };
}

/**
 * The shaped text size `layoutButtonContent` aligns against: the ceiled width, not the raw pen advance
 * (`button.cpp:343,349` read the same `text_buf->get_size()` as the minimum size). The height needs no
 * ceil: the line pitch sums independently ceiled ascent and descent and an integral theme spacing.
 */
export function labelNaturalSize(layout: TextLayoutResult | null): Vector2 {
  return layout ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx } : { x: 0, y: 0 };
}

/**
 * The width a wrapping label shapes at: what `layoutButtonContent` leaves of the box after the icon
 * (`button.cpp:428-432`), from the label's unwrapped shape. The painter and the minimum-size solver
 * both call it, so they wrap alike.
 */
export function wrappedLabelWidthPx(input: ButtonContentFacts, unwrapped: TextLayoutResult | null): number {
  const { drawableSize } = layoutButtonContent({
    ...input,
    textNaturalSize: labelNaturalSize(unwrapped),
    isTextRtl: infersRtl(unwrapped),
  });
  return buttonTextBufWidthPx(drawableSize.x);
}

/**
 * The width a wrapping label shapes at while a solver measures: what `layoutButtonContent` leaves in the
 * node's tentative rect (`button.cpp:428-432`). The first pass has no rect and shapes unwrapped, as does
 * AUTOWRAP_OFF, so the width is 0. Only an expanded icon reads the unwrapped label (its height), so
 * `unwrapped` runs only then.
 */
export function tentativeWrapWidthPx(
  props: ButtonWrapProperties & { expandIcon?: boolean },
  rect: Rect2 | undefined,
  contentAt: (rectSize: Vector2) => ButtonContentFacts,
  unwrapped: () => TextLayoutResult | null
): number {
  if (rect === undefined || !isButtonAutowrapped(props)) return 0;
  return wrappedLabelWidthPx(contentAt({ x: rect.w, y: rect.h }), props.expandIcon ? unwrapped() : null);
}

/** A shaped label's contribution to a minimum size: its text width ({@link textMinimumWidthPx}) and height, or none without a layout. */
function labelMinimumTextSize(
  layout: TextLayoutResult | null,
  props: TextClipProperties & ButtonWrapProperties
): Vector2 {
  if (!layout) return { x: 0, y: 0 };
  return { x: textMinimumWidthPx(layout.widthPx, props), y: layout.heightPx };
}

/** `button.cpp:266-275`: LEFT and RIGHT trade places under RTL, and any other value stays. */
function swapAlignmentSide(alignment: number): number {
  if (alignment === H_RIGHT) return H_LEFT;
  if (alignment === H_LEFT) return H_RIGHT;
  return alignment;
}

/** `Button::is_clipped` (`button.cpp:332`): `clip_text`, a trimming overrun or autowrap. */
export function isButtonTextClipped(props: TextClipProperties & ButtonWrapProperties): boolean {
  return isTextWidthClipped(props) || isButtonAutowrapped(props);
}

/**
 * A Button-family label's width contribution to the minimum size: the ceiled shaped width, or 0 when
 * {@link isButtonTextClipped}, since a narrower box cuts, trims or wraps it (`button.cpp:493-495`).
 */
function textMinimumWidthPx(
  measuredWidthPx: number,
  props: TextClipProperties & ButtonWrapProperties
): number {
  return isButtonTextClipped(props) ? 0 : shapedTextSizeWidthPx(measuredWidthPx);
}

/**
 * The ceiling's leftover (`button.cpp:437-439`): only CENTER centres the whole paragraph box in the
 * drawable width, and every other alignment starts the box at its left edge.
 */
function textBoxOffsetPx(drawableWidthPx: number, alignment: number): number {
  if (alignment !== H_CENTER) return 0;
  return (drawableWidthPx - buttonTextBufWidthPx(drawableWidthPx)) / 2;
}

/**
 * A Button-family line's shift in its drawable box: `button.cpp:437-441`, then
 * `TextParagraph::draw`'s alignment (`text_paragraph.cpp:887-922`). Every arm
 * measures against the ceiled paragraph width (`:437`), not the drawable width.
 * @param contentWidthPx `shaped_text_get_width`, ceiled (`text_server_adv.cpp:7561-7570`).
 * @param isRtl Whether the line infers RTL, which an overflowing CENTER line and a FILL line read.
 */
function buttonTextAlignShiftPx(
  contentWidthPx: number,
  drawableWidthPx: number,
  alignment: number,
  isRtl: boolean
): number {
  return (
    textBoxOffsetPx(drawableWidthPx, alignment) +
    textParagraphLineShiftPx(contentWidthPx, buttonTextBufWidthPx(drawableWidthPx), alignment, isRtl)
  );
}

/** A label line cut to its paragraph box, with its x offset from `ButtonTextLayout.boxLeftPx`. */
export interface ButtonDrawnLine {
  line: TextLineLayout;
  offsetXPx: number;
}

/**
 * The label lines as `TextParagraph::draw` paints them in the Button's paragraph box, so
 * an overlong line or wrapped word stays inside it. `<ButtonLabel>` calls it.
 */
export function buttonDrawnLabel(
  lines: readonly TextLineLayout[],
  drawableWidthPx: number,
  alignment: number
): ButtonDrawnLine[] {
  const boxOffsetPx = textBoxOffsetPx(drawableWidthPx, alignment);
  return drawnLinesInBox(lines, buttonTextBufWidthPx(drawableWidthPx), alignment, false).map(
    ({ line, shiftPx }) => ({ line, offsetXPx: boxOffsetPx + shiftPx })
  );
}

/** What {@link trimButtonLabel} trims with, beyond the layout and the box. */
export interface ButtonLabelTrimOptions extends Omit<TextBufferTrimOptions, 'fontMetrics'> {
  /** The label wraps: Button hides no line, so `TextParagraph::_shape_lines` trims no row of it. */
  isWrapped: boolean;
}

/**
 * The label trimmed to its paragraph box by `text_overrun_behavior`: `TextParagraph::_shape_lines`
 * trims each row of an unwrapped buffer on the box width `ceil(max(1, drawable width))`
 * (`button.cpp:428,432`, `text_paragraph.cpp:228-262,282-293`). A wrapped label stays whole.
 *
 * @canonical A Button-family label trimmed to its paragraph box by text_overrun_behavior
 */
export function trimButtonLabel(
  layout: TextLayoutResult,
  overrunBehavior: number | undefined,
  drawableWidthPx: number,
  { isWrapped, ...options }: ButtonLabelTrimOptions
): TextLayoutResult {
  const flags = overrunFlagsForBehavior(overrunBehavior);
  if (!flags.trim || isWrapped) return layout;
  return trimLayoutToWidth(layout, buttonTextBufWidthPx(drawableWidthPx), flags, {
    fontMetrics: layout.fontMetrics,
    ...options,
  });
}

/** The width `button.cpp:424-432` gives the text buffer: the drawable width, at least 1, ceiled. */
function buttonTextBufWidthPx(drawableWidthPx: number): number {
  return Math.ceil(Math.max(1, drawableWidthPx));
}

interface ButtonContentSizeInput {
  /** The whole paragraph: every row of a wrapped label. */
  textSize: Vector2;
  /** `font->get_height()`: one line, which a stacked or centred icon adds to or floors at (`button.cpp:517-521`). */
  lineHeightPx: number;
  hasText: boolean;
  /** The fitted icon, or `null` for no icon or an `expand_icon` one. */
  iconSize: Vector2 | null;
  iconAlignment: number;
  verticalIconAlignment: number;
  hSeparation: number;
}

/**
 * The text and icon terms of `Button::get_minimum_size_for_text_and_icon` (`button.cpp:492-523`),
 * without the stylebox margin, for any control that draws a Button.
 */
export function buttonContentSize(input: ButtonContentSizeInput): Vector2 {
  const { textSize, lineHeightPx, hasText, iconSize, iconAlignment, verticalIconAlignment, hSeparation } =
    input;
  const isVerticallyCentred = verticalIconAlignment === VerticalAlignment.VERTICAL_ALIGNMENT_CENTER;
  const stackHeights = (above: number, below: number) =>
    isVerticallyCentred ? Math.max(above, below) : above + below;
  let width = textSize.x;
  let height = textSize.y;

  if (iconSize) {
    height = stackHeights(height, iconSize.y);
    if (iconAlignment !== HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER) {
      width += iconSize.x;
      if (hasText) width += Math.max(0, hSeparation);
    } else {
      width = Math.max(width, iconSize.x);
    }
  }

  if (hasText) height = stackHeights(lineHeightPx, height);

  return { x: width, y: height };
}

/**
 * The icon `Button::get_minimum_size_for_text_and_icon` counts (`button.cpp:497-499`): the fitted icon, and
 * none for an `expand_icon`, whose size the box decides, or for an icon with no area.
 */
function buttonMinimumIconSize(
  naturalSize: Vector2 | null,
  expandIcon: boolean,
  iconMaxWidth: number
): Vector2 | null {
  if (expandIcon || !naturalSize || naturalSize.x <= 0 || naturalSize.y <= 0) return null;
  return fitIconSize(naturalSize, iconMaxWidth);
}

/** {@link buttonContentSize} of the node `facts` describe, with its shaped `label`, `null` when it has none. */
export function buttonContentMinimumSize(
  facts: ButtonContentFacts,
  label: TextLayoutResult | null,
  props: TextClipProperties & ButtonWrapProperties
): Vector2 {
  return minimumSizeOfText(facts, labelMinimumTextSize(label, props), label?.linePitchPx ?? 0);
}

/**
 * {@link buttonContentMinimumSize} for a text measured, not shaped: one OptionButton item, which shapes
 * a fresh one-line paragraph (`button.cpp:484-489`, from `option_button.cpp:451`).
 */
export function measuredContentMinimumSize(
  facts: ButtonContentFacts,
  measured: Vector2,
  props: TextClipProperties & ButtonWrapProperties
): Vector2 {
  return minimumSizeOfText(facts, { x: textMinimumWidthPx(measured.x, props), y: measured.y }, measured.y);
}

function minimumSizeOfText(facts: ButtonContentFacts, textSize: Vector2, lineHeightPx: number): Vector2 {
  return buttonContentSize({
    textSize,
    lineHeightPx,
    hasText: facts.hasText,
    iconSize: buttonMinimumIconSize(facts.iconNaturalSize, facts.expandIcon, facts.iconMaxWidth),
    iconAlignment: facts.iconAlignment,
    verticalIconAlignment: facts.verticalIconAlignment,
    hSeparation: facts.hSeparation,
  });
}

/**
 * `CheckBox::get_minimum_size` and `CheckButton::get_minimum_size` (`check_box.cpp:64-79`,
 * `check_button.cpp:64-79`) less the margins: Button's `content` plus the element it reserves, with
 * `h_separation` between them while both have a width. The gate is `tex_size.width > 0 || tex_size.height > 0`
 * (`check_box.cpp:67`), so a zero-width element with height still floors the height. The caller passes `hSeparation` already clamped.
 */
export function withReservedElementSize(content: Vector2, element: Vector2, hSeparation: number): Vector2 {
  if (element.x <= 0 && element.y <= 0) return content;
  const separation = content.x > 0 && element.x > 0 ? hSeparation : 0;
  return { x: content.x + separation + element.x, y: Math.max(content.y, element.y) };
}

/**
 * Button's `icon` as the first texture slot of a type that registers a `TextureSlotsFn`, so
 * `SolveNode.textureSize` is the icon's size for every Button subclass, as it is for a Button. The slot
 * is there without an icon too, or the first themed icon would stand in for it.
 */
export function buttonIconSlotRequest(icon: string | undefined): TextureSlotRequest {
  return { key: 'icon', ref: icon ?? '' };
}

/**
 * One `font_size` key for every draw state (`default_theme.cpp:153`), but a colour key per
 * state: `font_color` and `font_disabled_color` (`:156,161`).
 */
export const BUTTON_THEME_KEYS: Record<ToggleDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
  pressed: { sizeKey: 'font_size', colorKey: 'font_pressed_color' },
};
