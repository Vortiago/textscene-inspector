/**
 * LinkButton's native (WebGL canvas) rect solver + draw-state/underline math —
 * `LinkButton::get_minimum_size`/`_notification` (`scene/gui/link_button.cpp`)
 * and the theme defaults `scene/theme/default_theme.cpp:196-210` registers
 * under type name `"LinkButton"`. Registered via
 * `controlSolverRegistry.registerMinimumSize`.
 *
 * LinkButton draws NO StyleBox at all (no `panel`/`normal` theme entry
 * exists for it — only a `focus` StyleBox, which a static, pointer-less
 * preview never draws: `has_focus(true)` is always false, the same
 * "collapsed BaseButton::get_draw_mode" restriction every other Button-family
 * slice in this codebase carries). `Component.tsx` draws text plus, per
 * `underline_mode`, a solid-fill underline stroke — no StyleBoxQuad.
 *
 * Pure data + functions, no THREE/React — painting is `Component.tsx`'s job.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
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

/** `SceneStringName(font)` = `"font"`, `default_theme.cpp:200`: `theme->set_font(SceneStringName(font), "LinkButton", Ref<Font>());`. */
export const LINKBUTTON_THEME_FONT_KEY = 'font';

// --- Draw state --------------------------------------------------------------

/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) collapsed to what
 * a pointer-less static preview can ever select — the same collapse every
 * other Button-family slice in this codebase documents: `disabled` wins
 * outright, else `pressing = status.pressed` (== `button_pressed`)
 * unconditionally, `DRAW_HOVER`/`DRAW_HOVER_PRESSED` never fire.
 */
export type LinkButtonDrawState = 'normal' | 'pressed' | 'disabled';

export function resolveLinkButtonDrawState(props: LinkButtonProperties): LinkButtonDrawState {
  if (props.disabled) return 'disabled';
  if (props.buttonPressed) return 'pressed';
  return 'normal';
}

/** `control_font_color` (`default_theme.cpp:101`), LinkButton's own `font_color` default (`:203`). */
export const LINKBUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_pressed_color = Color(1, 1, 1)` (`:108`), LinkButton's own `font_pressed_color` default (`:204`). */
export const LINKBUTTON_DEFAULT_PRESSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
/**
 * LinkButton registers NO `font_disabled_color` of its own anywhere in
 * `default_theme.cpp` (`:196-210`), and neither does any ancestor in its
 * ClassDB chain (`LinkButton -> BaseButton -> Control -> ...` —
 * `scene/theme/theme_db.cpp`'s `get_native_type_dependencies`, the fallback
 * `ThemeOwner::get_theme_type_dependencies` walks once no owned/global Theme
 * resource carries the key). The lookup falls all the way through to
 * `ThemeOwner::get_theme_item_in_types`'s own final rung —
 * `global_context->get_fallback_theme()->get_theme_item(..., StringName())` —
 * which resolves to a default-constructed `Color()`: OPAQUE BLACK
 * `(0, 0, 0, 1)`, not `control_font_disabled_color`.
 */
export const LINKBUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };

const LINKBUTTON_THEME_KEYS: Record<LinkButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  pressed: { sizeKey: 'font_size', colorKey: 'font_pressed_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** Resolves LinkButton's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / LinkButton's own literal — `resolveTextTheme`'s own doc). */
export function linkButtonTextTheme(
  n: SolveNode,
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
 * `LinkButton::_notification`'s `NOTIFICATION_DRAW` switch on `get_draw_mode()`
 * (`link_button.cpp:249-278`, collapsed to the three reachable states above):
 * NORMAL and DISABLED only underline on `UNDERLINE_MODE_ALWAYS`; PRESSED (and
 * the unreachable HOVER states) underline whenever the mode is not
 * `UNDERLINE_MODE_NEVER`.
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
  /** Downward pixel offset from the line's baseline to the underline stroke's CENTRE. */
  y: number;
  /** The stroke's whole-pixel thickness, floored to at least 1px. */
  thickness: number;
}

/**
 * `link_button.cpp:306-308`: `underline_spacing` (theme constant, INT) +
 * `text_buf->get_line_underline_position()` (float) summed and narrowed to
 * an `int` — C++ narrowing TRUNCATES toward zero, which for this codebase's
 * always-positive `getUnderlinePositionPx` is `Math.trunc`. `y` then adds the
 * line's own ascent (`text_buf->get_line_ascent()`, the SAME whole-pixel
 * value `getAscentPx` produces — `openSansMetrics.ts`'s own doc). Thickness
 * is `MAX(1, ...)` then narrowed the same way (`:308`); the MAX is the
 * caller's job per `getUnderlineThicknessPx`'s own doc.
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
  /** The paragraph's own left edge, LOCAL Godot px. */
  originX: number;
  /** `text_buf->get_line_width()` narrowed to `int` — the CEILED pen extent, and the underline stroke's own length. */
  lineWidthPx: number;
}

/**
 * `LinkButton::_notification`'s text and underline origin
 * (`link_button.cpp:289-314`): LTR draws at `x = 0`, RTL at
 * `x = size.width - width`, and the underline spans `width` px from
 * whichever of the two it is.
 *
 * `width` is `TextParagraph::get_line_width`
 * (`scene/resources/text_paragraph.cpp:810`), i.e.
 * `TS->shaped_text_get_width` = `Math::ceil(sd->width)`
 * (`text_server_adv.cpp:7569`); LinkButton's `int width` narrowing therefore
 * removes nothing, and the stroke is a whole pixel WIDER than the raw pen
 * advance whenever that advance is fractional.
 */
export function linkButtonTextPlacement(
  rectWidthPx: number,
  shapedWidthPx: number,
  rtl: boolean
): LinkButtonTextPlacement {
  const lineWidthPx = shapedTextSizeWidthPx(shapedWidthPx);
  return { originX: rtl ? rectWidthPx - lineWidthPx : 0, lineWidthPx };
}

// --- Minimum size --------------------------------------------------------------

const OVERRUN_NO_TRIMMING = 0;

/**
 * `LinkButton::get_minimum_size` (`link_button.cpp:193-200`):
 * `text_buf->get_size()` — the shaped paragraph's own CEILED extent — with
 * the width zeroed whenever `overrun_behavior` is anything but
 * `OVERRUN_NO_TRIMMING` (Godot then lets the control's assigned rect drive
 * the width and trims/ellipsises to fit — not modelled here, see this
 * slice's `comparison.md`).
 */
export const linkButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LinkButtonProperties;
  const text = props.text ?? '';
  const hasText = text.length > 0;
  const state = resolveLinkButtonDrawState(props);
  const { fontSizePx } = linkButtonTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, LINKBUTTON_THEME_FONT_KEY);
  const layout: TextLayoutResult | null =
    hasText && ctx.measureText ? shapeButtonLabel(text, fontSizePx, fontMetrics) : null;

  const width =
    layout && (props.overrunBehavior ?? OVERRUN_NO_TRIMMING) === OVERRUN_NO_TRIMMING
      ? shapedTextSizeWidthPx(layout.widthPx)
      : 0;
  const height = layout ? layout.heightPx : 0;

  return { size: { x: width, y: height }, meta: layout ?? undefined };
};
