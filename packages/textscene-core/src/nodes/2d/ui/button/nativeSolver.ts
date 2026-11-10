/**
 * Button's native (WebGL canvas) rect solver: `Button::get_minimum_size_for_text_and_icon`
 * (`scene/gui/button.cpp:481-526`, reached with an empty `p_text` that reuses the node's shaped text),
 * the theme-override keys and Button's default colours. The draw-time layout lives in
 * `r3f/controls/native/buttonBase.ts`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  buttonContentSize,
  fitIconSize,
  pickButtonStyleBox,
  resolveToggleDrawState,
  shapeButtonLabel,
  type ToggleDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import { isTextWidthClipped } from '../../../../r3f/controls/native/text/textOverrun';
import { type Rgba } from '../../../../godot/math/math';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { clampAutowrapMode, shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { ButtonProperties } from './types';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_FOCUS_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
} from '../../../../godot/scene/theme';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { controlBidiOptions } from '../../../../r3f/controls/native/text/textBidiOptions';

/**
 * Button's theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:152`). Only
 * {@link buttonLabelShape} reads it, and this module and `Component.tsx` both call that, so the
 * two agree on the font.
 */
const BUTTON_THEME_FONT_KEY = 'font';

/**
 * One `font_size` key for every draw state (`default_theme.cpp:153`), but a colour key per
 * state: `font_color` and `font_disabled_color` (`:156,161`).
 */
export const BUTTON_THEME_KEYS: Record<ToggleDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
  pressed: { sizeKey: 'font_size', colorKey: 'font_pressed_color' },
};

/** Button's own `font_color` default (`default_theme.cpp:156`). */
export const BUTTON_DEFAULT_FONT_COLOR = CONTROL_FONT_COLOR;

/** Button's `font_disabled_color` default (`default_theme.cpp:161`). */
const BUTTON_DEFAULT_DISABLED_FONT_COLOR = CONTROL_FONT_DISABLED_COLOR;

/** Button's font colour default for each draw state (`default_theme.cpp:156-161`). */
export const BUTTON_DEFAULT_FONT_COLORS: Readonly<Record<ToggleDrawState, Rgba>> = {
  normal: BUTTON_DEFAULT_FONT_COLOR,
  pressed: CONTROL_FONT_PRESSED_COLOR,
  disabled: BUTTON_DEFAULT_DISABLED_FONT_COLOR,
};

/** `icon_normal_color` / `icon_disabled_color` theme_override_colors keys (`default_theme.cpp:164,169`). */
const BUTTON_ICON_COLOR_KEYS: Record<ToggleDrawState, string> = {
  normal: 'icon_normal_color',
  disabled: 'icon_disabled_color',
  pressed: 'icon_pressed_color',
};

/**
 * The default-theme icon modulate per draw state: `icon_normal_color = Color(1, 1, 1, 1)`
 * (`default_theme.cpp:164`) and `icon_disabled_color = Color(1, 1, 1, 0.4)` (`:169`). No other
 * builtin widget sets either key.
 */
export const BUTTON_ICON_MODULATE: Record<ToggleDrawState, Rgba> = {
  normal: { r: 1, g: 1, b: 1, a: 1 },
  pressed: { r: 1, g: 1, b: 1, a: 1 },
  disabled: { r: 1, g: 1, b: 1, a: 0.4 },
};

/** `font_focus_color` and its default (`default_theme.cpp:159`): the text of a focused, enabled Button (`button.cpp:284-285`). */
const BUTTON_FOCUS_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_focus_color' };

/** `icon_focus_color` (`button.cpp:286-288`): applied only where a theme sets it. */
const BUTTON_ICON_FOCUS_COLOR_KEY = 'icon_focus_color';

/** Whether `props` draws with the focus colours: a focused Button in the normal draw mode (`button.cpp:282-285`). */
export function isButtonFocusStyled(props: ButtonProperties, state: ToggleDrawState): boolean {
  return state === 'normal' && props.hasFocus === true;
}

/** Resolves this Button's icon modulate colour for `state`: `n.colors` (a local override or the ancestor Theme chain) wins, else the default-theme literal. */
export function buttonIconColor(colors: SolveNode['colors'], state: ToggleDrawState): Rgba {
  return colors[BUTTON_ICON_COLOR_KEYS[state]] ?? BUTTON_ICON_MODULATE[state];
}

/** The icon modulate of a focused Button in the normal draw mode: `icon_focus_color`, else white, never `icon_normal_color` (`button.cpp:286-288`). */
export function buttonFocusIconColor(colors: SolveNode['colors']): Rgba {
  return colors[BUTTON_ICON_FOCUS_COLOR_KEY] ?? BUTTON_ICON_MODULATE.normal;
}

/** Resolves this Button's theme font size and colour for `state`: overrides, else the ancestor Theme chain, the theme default or Button's own literal. */
export function buttonTextTheme(
  n: ShareNode,
  props: ButtonProperties,
  state: ToggleDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const isFocusStyled = isButtonFocusStyled(props, state);
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: isFocusStyled ? CONTROL_FONT_FOCUS_COLOR : BUTTON_DEFAULT_FONT_COLORS[state],
  };
  return resolveTextTheme(n, props, isFocusStyled ? BUTTON_FOCUS_KEYS : BUTTON_THEME_KEYS[state], defaults);
}

/**
 * Button's shaped label, the **solve handoff** share (`r3f/controls/native/solveHandoff.ts`) that
 * `buttonMinimumSize` and `Component.tsx` both call. `null` for empty text, which neither draws.
 * A plain function, not a `defineShare` memo: the memo's `(node, theme)` key cannot hold
 * `boxWidthPx`, and would answer the painter with the rows of the solver's tentative width.
 */
export function buttonLabelShape(
  n: ShareNode,
  theme: SolveContext['theme'],
  boxWidthPx = 0
): TextLayoutResult | null {
  const props = n.node.properties as ButtonProperties;
  const text = props.text ?? '';
  if (text.length === 0) return null;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const { fontSizePx } = buttonTextTheme(n, props, state, { theme });
  const mode = clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF);
  // Not `ctx.measureText`: its `Vector2` drops the layout the painter needs, and its readiness
  // gate belongs to the solver. The painter shapes unconditionally.
  return shapeButtonLabel(text, {
    fontSizePx,
    fontMetrics: resolveNodeFontMetrics(n, BUTTON_THEME_FONT_KEY),
    bidi: controlBidiOptions(props, n),
    boxWidthPx: mode === AutowrapMode.AUTOWRAP_OFF ? 0 : boxWidthPx,
    autowrapMode: mode,
    autowrapTrimFlags: props.autowrapTrimFlags,
  });
}

/**
 * The icon's share of the label's box, `drawable_size_remained.width`'s icon term
 * (`button.cpp:332-352`). The wrap width needs it before the text is shaped, so
 * before `layoutButtonContent` can run.
 */
function buttonIconReservationPx(
  n: ShareNode,
  props: ButtonProperties,
  ctx: Pick<SolveContext, 'theme'> & { theme: SolveContext['theme'] }
): number {
  if (!n.textureSize || n.textureSize.x <= 0 || n.textureSize.y <= 0) return 0;
  if (
    (props.iconAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT) ===
    HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
  )
    return 0;
  const iconSize = fitIconSize(n.textureSize, n.constants.icon_max_width ?? 0);
  return Math.round(iconSize.x) + Math.max(0, n.constants.h_separation ?? ctx.theme.separation);
}

/**
 * `Button::get_minimum_size_for_text_and_icon` (`button.cpp:481-526`), shaped by {@link buttonLabelShape},
 * without `align_to_largest_stylebox`, which the default theme disables (`:174`). `n.rtl` reaches only
 * the stylebox pick (`:525`, `<state>_mirrored`): the icon terms test `horizontal_icon_alignment`
 * unswapped against CENTER, so the side swap cannot move a minimum size.
 */
export const buttonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ButtonProperties;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.button, state, n.rtl);
  const { x: marginX, y: marginY } = contentMarginSize(styleBox);

  const hasText = (props.text ?? '').length > 0;
  // Pass 2 (`tentativeRect`) knows this node's width, which a wrapping label's height
  // depends on. Pass 1 shapes unwrapped. `is_clipped` is true under autowrap
  // (`button.cpp:332`), so the icon's reservation does not depend on the text.
  const tentative = ctx.tentativeRect?.(n);
  const wrapWidthPx =
    tentative === undefined ? 0 : tentative.w - marginX - buttonIconReservationPx(n, props, ctx);
  // An absent `ctx.measureText` means the text contributes nothing, while the margin and
  // the icon still count (`solverRegistry.ts`'s contract).
  const layout: TextLayoutResult | null = ctx.measureText
    ? buttonLabelShape(n, ctx.theme, wrapWidthPx)
    : null;
  // `minsize` starts from `paragraph->get_size()` (`button.cpp:492`), a max
  // over `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`):
  // the ceiled extent, not the raw pen advance.
  const textSize = layout ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx } : { x: 0, y: 0 };
  // button.cpp:493-495: `clip_text`, a trimming overrun behaviour or autowrap zeroes the
  // text's width contribution, since a narrower box trims or wraps it. The icon still counts.
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.AUTOWRAP_OFF);
  if (isTextWidthClipped(props) || autowrapMode !== AutowrapMode.AUTOWRAP_OFF) {
    textSize.x = 0;
  }

  const iconSize =
    !props.expandIcon && n.textureSize && n.textureSize.x > 0 && n.textureSize.y > 0
      ? fitIconSize(n.textureSize, n.constants.icon_max_width ?? 0)
      : null;
  const content = buttonContentSize({
    textSize,
    hasText,
    iconSize,
    iconAlignment: props.iconAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
    verticalIconAlignment: props.verticalIconAlignment ?? VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
    hSeparation: n.constants.h_separation ?? ctx.theme.separation,
  });

  return { x: marginX + content.x, y: marginY + content.y };
};
