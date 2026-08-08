/**
 * Button's native (WebGL canvas) rect solver —
 * `Button::get_minimum_size_for_text_and_icon` (`scene/gui/button.cpp:481-526`,
 * called from `get_minimum_size` with an empty `p_text`, which reuses the
 * node's OWN shaped text) — plus the theme-override key mapping
 * (`font_size`/`font_color`/`font_disabled_color`) and the two default
 * colours Button reads. Registered via
 * `controlSolverRegistry.registerMinimumSize`. Pure per-node math, no
 * THREE/React — painting is `NativeComponent.tsx`'s job, and the
 * icon/text content-LAYOUT math (draw-time positions) lives in the shared
 * `r3f/controls/native/buttonBase.ts` this module also uses for the
 * StyleBox/icon-sizing pieces.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  VERTICAL_ALIGNMENT_CENTER,
  fitIconSize,
  pickButtonStyleBox,
  resolveButtonDrawState,
  shapeButtonLabel,
  type ButtonDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { ControlColor } from '../control/types';
import type { ButtonProperties } from './types';

/**
 * Button's own theme font key — `SceneStringName(font)` = `"font"`,
 * `scene/theme/default_theme.cpp:152`:
 * `theme->set_font(SceneStringName(font), "Button", Ref<Font>());`. Fed to
 * `resolveNodeFontMetrics` by both this module and `Component.tsx`'s own
 * fallback shape (the path taken when `meta` is not a usable
 * `TextLayoutResult` — see that component's own doc) so the two agree on
 * which font this Button is in.
 */
export const BUTTON_THEME_FONT_KEY = 'font';

/**
 * Button reads `theme_override_font_sizes/font_size` for both states (a
 * SINGLE `font_size` theme key regardless of draw state,
 * `default_theme.cpp:153`) but a DIFFERENT colour key per state
 * (`font_color` / `font_disabled_color`, `:156,161`).
 */
export const BUTTON_THEME_KEYS: Record<ButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** `control_font_color` = `Color(0.875, 0.875, 0.875)` (`default_theme.cpp:101`), Button's own `font_color` default (`:156`). */
export const BUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/**
 * `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)`
 * (`default_theme.cpp:106`), Button's own `font_disabled_color` default
 * (`:161`). The numeric twin of `godotDefaultTheme.ts`'s
 * `CONTROL_FONT_DISABLED_COLOR` CSS string (`rgba(223, 223, 223, 0.5)`).
 */
export const BUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

/** `icon_normal_color` / `icon_disabled_color` theme_override_colors keys (`default_theme.cpp:164,169`). */
const BUTTON_ICON_COLOR_KEYS: Record<ButtonDrawState, string> = {
  normal: 'icon_normal_color',
  disabled: 'icon_disabled_color',
};

/**
 * The default-theme icon modulate per draw state: `icon_normal_color =
 * Color(1, 1, 1, 1)` (`default_theme.cpp:164`), `icon_disabled_color =
 * Color(1, 1, 1, 0.4)` (`:169`) — Button's OWN literals, not shared with any
 * other widget type (no other Godot builtin sets either key).
 */
const BUTTON_ICON_MODULATE: Record<ButtonDrawState, ControlColor> = {
  normal: { r: 1, g: 1, b: 1, a: 1 },
  disabled: { r: 1, g: 1, b: 1, a: 0.4 },
};

/** Resolves this Button's icon modulate colour for `state` (a `theme_override_colors` override wins, else the default-theme literal above). */
export function buttonIconColor(props: ButtonProperties, state: ButtonDrawState): ControlColor {
  return props.themeOverrideColors?.[BUTTON_ICON_COLOR_KEYS[state]] ?? BUTTON_ICON_MODULATE[state];
}

/** Resolves this Button's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / Button's own literal — `resolveTextTheme`'s own doc). */
export function buttonTextTheme(
  n: SolveNode,
  props: ButtonProperties,
  state: ButtonDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: state === 'disabled' ? BUTTON_DEFAULT_DISABLED_FONT_COLOR : BUTTON_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, BUTTON_THEME_KEYS[state], defaults);
}

/**
 * `Button::get_minimum_size_for_text_and_icon` (`button.cpp:481-526`), minus
 * `align_to_largest_stylebox` (Button's own default theme sets it to `0` /
 * disabled, `:174`, and this codebase never overrides it) and RTL/clip/
 * autowrap sizing (not modelled — see `buttonBase.ts`'s
 * `layoutButtonContent` doc for why).
 *
 * `n.textureSize` is `null` until the icon texture resolves — treated as "no
 * icon contribution yet", the same convention `texturerect/nativeSolver.ts`'s
 * `textureRectMinimumSize` already establishes for an unresolved texture. An
 * absent `ctx.measureText` is treated as "text contributes nothing" rather
 * than the whole function degrading to zero (`solverRegistry.ts`'s own
 * contract) — margin and icon still contribute, since neither depends on
 * text measurement.
 *
 * Shapes via `shapeText` DIRECTLY (`boxWidthPx: 0`, `autowrapMode: OFF`,
 * `lineSpacingPx: 0` — Button never wraps and reads no `line_spacing` theme
 * key at all, unlike Label) rather than through `ctx.measureText`, whose own
 * `Vec2`-only return would discard the shaped `TextLayoutResult` this
 * function attaches as `meta` — `Button`'s painter (`Component.tsx`) reads it
 * back instead of re-shaping the SAME text with the SAME literal parameters
 * on every render (`comparison.md`'s own "Native (WebGL canvas) painter"
 * section has the measured cost). `ctx.measureText` is still the presence
 * GATE (`!ctx.measureText` still means "text contributes nothing", exactly
 * as before this — a null measurer never reaches `shapeText` at all), so the
 * `TextMeasurer` abstraction still decides whether text shaping runs; only
 * the ACTUAL computation moved to the function this codebase's own painters
 * already call directly for the SAME parameters.
 */
export const buttonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ButtonProperties;
  const state = resolveButtonDrawState(props.disabled);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.button, state);
  const { x: marginX, y: marginY } = contentMarginSize(styleBox);

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const { fontSizePx } = buttonTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, BUTTON_THEME_FONT_KEY);
  const layout: TextLayoutResult | null =
    hasText && ctx.measureText
      ? shapeButtonLabel(text, fontSizePx, fontMetrics)
      : null;
  // `minsize` starts from `paragraph->get_size()` (`button.cpp:492`), a max
  // over `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`)
  // — the CEILED extent, not the raw pen advance.
  const textSize = layout
    ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
    : { x: 0, y: 0 };

  let width = textSize.x;
  let height = textSize.y;

  const iconAlignment = props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT;
  const verticalIconAlignment = props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER;
  const iconMaxWidth = props.themeOverrideConstants?.icon_max_width ?? 0;
  const hSeparation = props.themeOverrideConstants?.h_separation ?? ctx.theme.separation;

  if (!props.expandIcon && n.textureSize && n.textureSize.x > 0 && n.textureSize.y > 0) {
    const iconSize = fitIconSize(n.textureSize, iconMaxWidth);

    if (verticalIconAlignment === VERTICAL_ALIGNMENT_CENTER) {
      height = Math.max(height, iconSize.y);
    } else {
      height += iconSize.y;
    }

    if (iconAlignment !== HORIZONTAL_ALIGNMENT_CENTER) {
      width += iconSize.x;
      if (hasText) width += Math.max(0, hSeparation);
    } else {
      width = Math.max(width, iconSize.x);
    }
  }

  if (hasText) {
    if (verticalIconAlignment === VERTICAL_ALIGNMENT_CENTER) {
      height = Math.max(textSize.y, height);
    } else {
      height += textSize.y;
    }
  }

  return { size: { x: marginX + width, y: marginY + height }, meta: layout ?? undefined };
};
