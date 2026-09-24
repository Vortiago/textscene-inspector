/**
 * OptionButton's native rect solver and content layout: `get_minimum_size`, `_refresh_size_cache` and
 * `_notification` (`scene/gui/option_button.cpp`), with the defaults `scene/theme/default_theme.cpp:212-251`
 * registers for "OptionButton". Its "pressed" means an open popup, which a static preview never reaches, so
 * `get_draw_mode()` gives only `DRAW_NORMAL` or `DRAW_DISABLED`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  buttonTextAlignShiftPx,
  centredTextTopPx,
  HORIZONTAL_ALIGNMENT_RIGHT,
  pickButtonStyleBox,
  resolveButtonDrawState,
  tintColor,
  type ButtonDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import type { ControlColor } from '../control/types';
import type { OptionButtonProperties } from './types';

// Re-exported so Component.tsx imports the shared Button pieces under one name.
export { pickButtonStyleBox, resolveButtonDrawState, tintColor };

/**
 * OptionButton's own theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:237`). This
 * module and `Component.tsx` both pass it to `resolveNodeFontMetrics`, so they shape in the same font.
 */
export const OPTION_BUTTON_THEME_FONT_KEY = 'font';

// Theme font colours

/** `control_font_color` (`default_theme.cpp:101`), OptionButton's `font_color` default (`:240`). */
export const OPTION_BUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`:106`), OptionButton's `font_disabled_color` default (`:245`). */
export const OPTION_BUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const OPTION_BUTTON_THEME_KEYS: Record<ButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** OptionButton's theme font size and colour for `state`: its overrides, else the ancestor Theme chain, else the theme default, else OptionButton's literal (`resolveTextTheme`). */
export function optionButtonTextTheme(
  n: SolveNode,
  props: OptionButtonProperties,
  state: ButtonDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: state === 'disabled' ? OPTION_BUTTON_DEFAULT_DISABLED_FONT_COLOR : OPTION_BUTTON_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, OPTION_BUTTON_THEME_KEYS[state], defaults);
}

// StyleBox chrome
// OptionButton's chrome (`default_theme.cpp:212-215`) has `2*default_margin` by `default_margin` content
// margins, unlike Button's (`theme.optionButtonMarginX/Y`). `nativeTheme.ts` builds it once per theme as
// `theme.widgets.optionButton`, so solve and paint share one struct and `StyleBoxQuad` keeps its geometry.

// Selected item

/**
 * The bounds-guarded selected-item lookup: an out-of-range or absent
 * `selected` renders empty text rather than defaulting to item 0.
 */
export function resolveOptionButtonSelectedText(props: OptionButtonProperties): string {
  const items = props.items ?? [];
  const selectedIndex = props.selected ?? -1;
  const item = selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : undefined;
  return item?.text ?? '';
}

// Arrow

/** `option_button_arrow.svg`'s authored size (`native/themeIcons.ts`), 12x12, never run through `_fit_icon_size`. */
export const OPTION_BUTTON_ARROW_NATURAL_SIZE: Vec2 = { x: 12, y: 12 };

/** `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, OptionButton, arrow_icon, "arrow")` (`option_button.cpp:620`), the one themeable icon slot. */
export const optionButtonTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const themed = themedIcons.arrow;
  const requests: TextureSlotRequest[] = [];
  if (themed) requests.push({ key: 'arrow', ref: themed.ref, scope: themed.resources });
  return requests;
};

/**
 * `get_minimum_size` and `_notification` read `theme_cache.arrow_icon->get_size()` directly
 * (`option_button.cpp:62,131-133`), never through `_fit_icon_size` or `icon_max_width`, so a themed arrow
 * changes the reserved width and the draw position. The vendored size is the fallback.
 */
export function optionButtonArrowSize(n: Pick<SolveNode, 'textureSlots'>): Vec2 {
  return n.textureSlots.arrow ?? OPTION_BUTTON_ARROW_NATURAL_SIZE;
}

/** `h_separation`: OptionButton's default (`default_theme.cpp:249`, `round(4*scale)`) equals `theme.separation`. */
export function optionButtonHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

// Minimum size

/**
 * `OptionButton::get_minimum_size` (`option_button.cpp:50-68`) at `fit_to_longest_item` true (`option_button.h`),
 * which is not parsed: the widest and tallest item text (`_refresh_size_cache`, `:451-458`) with the
 * stylebox minimum, plus the arrow width and `h_separation` unconditionally. CheckBox's
 * `if (content_size.width > 0 ...)` guard has no counterpart here.
 */
export const optionButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as OptionButtonProperties;
  const state = resolveButtonDrawState(props.disabled);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.optionButton, state, n.rtl);
  const { x: marginX, y: marginY } = contentMarginSize(styleBox);

  const { fontSizePx } = optionButtonTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, OPTION_BUTTON_THEME_FONT_KEY);
  const items = props.items ?? [];
  const texts = items.length > 0 ? items.map((item) => item.text) : [''];

  let textW = 0;
  let textH = 0;
  if (ctx.measureText) {
    for (const text of texts) {
      if (!text) continue;
      const size = ctx.measureText(text, fontSizePx, 0, fontMetrics);
      // Each item goes through `Button::get_minimum_size_for_text_and_icon` (`button.cpp:492`), whose
      // `paragraph->get_size()` is ceiled (`text_paragraph.cpp:601-608` -> `text_server_adv.cpp:7524-7537`),
      // so the max is over whole-pixel widths.
      textW = Math.max(textW, shapedTextSizeWidthPx(size.x));
      textH = Math.max(textH, size.y);
    }
  }

  const hSeparation = optionButtonHSeparation(n.constants, ctx);
  const arrow = optionButtonArrowSize(n);

  const width = marginX + textW + arrow.x + hSeparation;
  const height = marginY + Math.max(textH, arrow.y);

  return { x: width, y: height };
};

// Content layout: text and arrow placement

export interface OptionButtonContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** The current draw-state StyleBox's content margins. */
  styleMargin: { left: number; top: number; right: number; bottom: number };
  arrowSize: Vec2;
  /** `arrow_margin` theme constant, measured from the full rect edge, not the content-margin edge. */
  arrowMargin: number;
  /** `h_separation` theme constant, clamped to >= 0, part of the arrow's internal-margin reservation. */
  hSeparation: number;
  /** The selected item's shaped natural size, `(0, 0)` with no selection. */
  textNaturalSize: Vec2;
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`): moves the arrow to the left edge and the label against the right margin. */
  rtl: boolean;
}

export interface OptionButtonContentLayout {
  /** Local to the control's top-left, Godot px. */
  arrowRect: Rect2;
  /** The text box's top-left, local Godot px, for `<TextRun>`, which anchors each line at its baseline from there (`buildGlyphQuadArrays`). Always returned: the caller decides whether text draws. */
  textOffset: Vec2;
}

/**
 * The arrow `ofs` (`option_button.cpp:122-131`) and Button's internal-margin text reservation
 * (`button.cpp:247-260,444-456`), which `layoutButtonContent` does not model. The one internal margin set
 * (`option_button.cpp:83-89,139-147`) is the arrow width, and `is_layout_rtl()` picks its side
 * (option_button.cpp:139-147), so the label keeps `arrowSize.x + h_separation` clear. The arrow reads only `arrow_margin` against the full control size.
 */
export function layoutOptionButtonContent(input: OptionButtonContentInput): OptionButtonContentLayout {
  const { rectSize, styleMargin, arrowSize, arrowMargin, hSeparation, textNaturalSize, rtl } = input;

  const arrowRect: Rect2 = {
    x: Math.floor(rtl ? arrowMargin : rectSize.x - arrowSize.x - arrowMargin),
    y: Math.floor(Math.abs((rectSize.y - arrowSize.y) / 2)),
    w: arrowSize.x,
    h: arrowSize.y,
  };

  const customElementHeight = rectSize.y - styleMargin.top - styleMargin.bottom;
  const reserved = arrowSize.x + hSeparation;
  const drawableWidth = rectSize.x - styleMargin.left - styleMargin.right - reserved;
  // Under `rtl` the reservation moves to SIDE_LEFT and the constructor's `HORIZONTAL_ALIGNMENT_LEFT`
  // (`:654`) swaps to RIGHT (`button.cpp:271-275`), so only that arm reads `h_separation`.
  const textOffset: Vec2 = {
    x: rtl
      ? styleMargin.left +
        reserved +
        buttonTextAlignShiftPx(textNaturalSize.x, drawableWidth, HORIZONTAL_ALIGNMENT_RIGHT)
      : styleMargin.left,
    y: centredTextTopPx(customElementHeight, textNaturalSize.y, styleMargin.top),
  };

  return { arrowRect, textOffset };
}
