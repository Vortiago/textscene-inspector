/**
 * LinkButton's native rect solver, draw state and underline math: `LinkButton::get_minimum_size` and
 * `_notification` (`scene/gui/link_button.cpp`), with the defaults `scene/theme/default_theme.cpp:196-210`
 * registers for "LinkButton". It has no StyleBox but `focus`, which a static preview never draws, so
 * `Component.tsx` draws only text and an underline stroke.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { shapeButtonLabel } from '../../../../r3f/controls/native/buttonBase';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapedTextSizeWidthPx, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { getUnderlinePositionPx, getUnderlineThicknessPx } from '../../../../r3f/controls/native/text/openSansMetrics';
import type { ControlColor } from '../control/types';
import type { LinkButtonProperties } from './types';

/** `SceneStringName(font)`, registered for "LinkButton" at `default_theme.cpp:200`. */
export const LINKBUTTON_THEME_FONT_KEY = 'font';

// Draw state

/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) collapsed to what a static preview can
 * select, as in every Button-family slice: `disabled` wins, else `button_pressed`, and the hover states
 * never fire.
 */
export type LinkButtonDrawState = 'normal' | 'pressed' | 'disabled';

export function resolveLinkButtonDrawState(props: LinkButtonProperties): LinkButtonDrawState {
  if (props.disabled) return 'disabled';
  if (props.buttonPressed) return 'pressed';
  return 'normal';
}

/** `control_font_color` (`default_theme.cpp:101`), LinkButton's `font_color` default (`:203`). */
export const LINKBUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_pressed_color = Color(1, 1, 1)` (`:108`), LinkButton's `font_pressed_color` default (`:204`). */
export const LINKBUTTON_DEFAULT_PRESSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
/**
 * Neither LinkButton's `default_theme.cpp` block (`:196-210`) nor an ancestor in its `scene/theme/theme_db.cpp`
 * type chain registers `font_disabled_color`, so `ThemeOwner::get_theme_item_in_types` falls through to
 * the fallback theme's `get_theme_item(..., StringName())`: a default `Color()`, opaque black, not
 * `control_font_disabled_color`.
 */
export const LINKBUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };

const LINKBUTTON_THEME_KEYS: Record<LinkButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  pressed: { sizeKey: 'font_size', colorKey: 'font_pressed_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** LinkButton's theme font size and colour for `state`: its overrides, else the ancestor Theme chain, else the theme default, else LinkButton's literal (`resolveTextTheme`). */
export function linkButtonTextTheme(
  n: ShareNode,
  props: LinkButtonProperties,
  state: LinkButtonDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color:
      state === 'disabled'
        ? LINKBUTTON_DEFAULT_DISABLED_FONT_COLOR
        : state === 'pressed'
          ? LINKBUTTON_DEFAULT_PRESSED_FONT_COLOR
          : LINKBUTTON_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, LINKBUTTON_THEME_KEYS[state], defaults);
}

const UNDERLINE_MODE_ALWAYS = 0;
const UNDERLINE_MODE_NEVER = 2;

/**
 * `NOTIFICATION_DRAW`'s switch on `get_draw_mode()` (`link_button.cpp:249-278`): NORMAL and DISABLED
 * underline only on `UNDERLINE_MODE_ALWAYS`, and PRESSED (like the unreachable hover states) whenever
 * the mode is not `UNDERLINE_MODE_NEVER`.
 */
export function shouldUnderline(state: LinkButtonDrawState, underlineMode: number | undefined): boolean {
  const mode = underlineMode ?? UNDERLINE_MODE_ALWAYS;
  if (state === 'pressed') return mode !== UNDERLINE_MODE_NEVER;
  return mode === UNDERLINE_MODE_ALWAYS;
}

/** `underline_spacing` theme constant, `round(2*scale)` (`default_theme.cpp:210`). */
export function linkButtonUnderlineSpacing(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  const override = constants.underline_spacing;
  if (override !== undefined) return override;
  return Math.round(2 * ctx.theme.scale);
}

export interface UnderlineGeometry {
  /** Downward offset in px from the baseline to the centre of the underline stroke. */
  y: number;
  /** The stroke's whole-pixel thickness, floored to at least 1px. */
  thickness: number;
}

/**
 * `link_button.cpp:306-308`: `underline_spacing` (int) plus `text_buf->get_line_underline_position()`
 * (float), narrowed to `int`, which truncates toward zero. `y` adds the line ascent, the whole-pixel
 * value `getAscentPx` gives. Thickness is `MAX(1, ...)` narrowed the same way (`:308`), with the MAX
 * applied here, as `getUnderlineThicknessPx` requires.
 */
export function linkButtonUnderlineGeometry(
  fontSizePx: number,
  underlineSpacingConstant: number,
  ascentPx: number
): UnderlineGeometry {
  const spacing = Math.trunc(underlineSpacingConstant + getUnderlinePositionPx(fontSizePx));
  const y = ascentPx + spacing;
  const thickness = Math.trunc(Math.max(1, getUnderlineThicknessPx(fontSizePx)));
  return { y, thickness };
}

export interface LinkButtonTextPlacement {
  /** The paragraph's left edge, local Godot px. */
  originX: number;
  /** `text_buf->get_line_width()` narrowed to `int`: the ceiled pen extent, and the underline's length. */
  lineWidthPx: number;
}

/**
 * The text and underline origin (`link_button.cpp:289-314`): `x = 0` under LTR, `size.width - width` under
 * RTL, with the underline `width` px long from there. `width` is `TextParagraph::get_line_width`
 * (`scene/resources/text_paragraph.cpp:810`), `Math::ceil(sd->width)` (`text_server_adv.cpp:7569`), so the
 * stroke is a whole pixel wider than a fractional pen advance.
 */
export function linkButtonTextPlacement(
  rectWidthPx: number,
  shapedWidthPx: number,
  rtl: boolean
): LinkButtonTextPlacement {
  const lineWidthPx = shapedTextSizeWidthPx(shapedWidthPx);
  return { originX: rtl ? rectWidthPx - lineWidthPx : 0, lineWidthPx };
}

// Minimum size

const OVERRUN_NO_TRIMMING = 0;

/**
 * LinkButton's shaped label, null for empty text: the solve-handoff share
 * (`r3f/controls/native/solveHandoff.ts`) of `linkButtonMinimumSize` and `Component.tsx`. The painter's
 * overrun trimming is not part of it, since it reads the solved rect.
 */
export const linkButtonLabelShape = defineShare<TextLayoutResult | null>((n, theme) => {
  const props = n.node.properties as LinkButtonProperties;
  const text = props.text ?? '';
  if (text.length === 0) return null;
  const state = resolveLinkButtonDrawState(props);
  const { fontSizePx } = linkButtonTextTheme(n, props, state, { theme });
  return shapeButtonLabel(text, fontSizePx, resolveNodeFontMetrics(n, LINKBUTTON_THEME_FONT_KEY));
});

/**
 * `LinkButton::get_minimum_size` (`link_button.cpp:193-200`): `text_buf->get_size()`, the ceiled shaped
 * extent, with the width zeroed for any `overrun_behavior` but `OVERRUN_NO_TRIMMING`. The assigned rect
 * then drives the width, and `Component.tsx` trims to it.
 */
export const linkButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LinkButtonProperties;
  const layout: TextLayoutResult | null = ctx.measureText ? linkButtonLabelShape(n, ctx.theme) : null;

  const width =
    layout && (props.overrunBehavior ?? OVERRUN_NO_TRIMMING) === OVERRUN_NO_TRIMMING
      ? shapedTextSizeWidthPx(layout.widthPx)
      : 0;
  const height = layout ? layout.heightPx : 0;

  return { x: width, y: height };
};
