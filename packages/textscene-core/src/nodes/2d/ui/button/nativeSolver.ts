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
import {
  AutowrapMode,
  clampAutowrapMode,
  shapedTextSizeWidthPx,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { OverrunBehavior } from '../../../../r3f/controls/native/text/textOverrun';
import type { ControlColor } from '../control/types';
import type { ButtonProperties } from './types';

/**
 * Button's theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:152`). Only
 * {@link buttonLabelShape} reads it, and this module and `Component.tsx` both call that, so the
 * two agree on the font.
 */
export const BUTTON_THEME_FONT_KEY = 'font';

/**
 * One `font_size` key for every draw state (`default_theme.cpp:153`), but a colour key per
 * state: `font_color` and `font_disabled_color` (`:156,161`).
 */
export const BUTTON_THEME_KEYS: Record<ButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** `control_font_color` = `Color(0.875, 0.875, 0.875)` (`default_theme.cpp:101`), Button's own `font_color` default (`:156`). */
export const BUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/**
 * `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`default_theme.cpp:106`),
 * Button's `font_disabled_color` default (`:161`). The numeric twin of `godotDefaultTheme.ts`'s
 * `CONTROL_FONT_DISABLED_COLOR` (`rgba(223, 223, 223, 0.5)`).
 */
export const BUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

/** `icon_normal_color` / `icon_disabled_color` theme_override_colors keys (`default_theme.cpp:164,169`). */
const BUTTON_ICON_COLOR_KEYS: Record<ButtonDrawState, string> = {
  normal: 'icon_normal_color',
  disabled: 'icon_disabled_color',
};

/**
 * The default-theme icon modulate per draw state: `icon_normal_color = Color(1, 1, 1, 1)`
 * (`default_theme.cpp:164`) and `icon_disabled_color = Color(1, 1, 1, 0.4)` (`:169`). No other
 * builtin widget sets either key.
 */
const BUTTON_ICON_MODULATE: Record<ButtonDrawState, ControlColor> = {
  normal: { r: 1, g: 1, b: 1, a: 1 },
  disabled: { r: 1, g: 1, b: 1, a: 0.4 },
};

/** Resolves this Button's icon modulate colour for `state`: `n.colors` (a local override or the ancestor Theme chain) wins, else the default-theme literal. */
export function buttonIconColor(colors: SolveNode['colors'], state: ButtonDrawState): ControlColor {
  return colors[BUTTON_ICON_COLOR_KEYS[state]] ?? BUTTON_ICON_MODULATE[state];
}

/** Resolves this Button's theme font size and colour for `state`: overrides, else the ancestor Theme chain, the theme default or Button's own literal. */
export function buttonTextTheme(
  n: ShareNode,
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
  const state = resolveButtonDrawState(props.disabled);
  const { fontSizePx } = buttonTextTheme(n, props, state, { theme });
  const mode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  // Not `ctx.measureText`: its `Vec2` drops the layout the painter needs, and its readiness
  // gate belongs to the solver. The painter shapes unconditionally.
  return shapeButtonLabel(
    text,
    fontSizePx,
    resolveNodeFontMetrics(n, BUTTON_THEME_FONT_KEY),
    mode === AutowrapMode.OFF ? 0 : boxWidthPx,
    mode,
    props.autowrapTrimFlags
  );
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
  if ((props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT) === HORIZONTAL_ALIGNMENT_CENTER) return 0;
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
  const state = resolveButtonDrawState(props.disabled);
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
  const layout: TextLayoutResult | null = ctx.measureText ? buttonLabelShape(n, ctx.theme, wrapWidthPx) : null;
  // `minsize` starts from `paragraph->get_size()` (`button.cpp:492`), a max
  // over `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`):
  // the ceiled extent, not the raw pen advance.
  const textSize = layout
    ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
    : { x: 0, y: 0 };
  // button.cpp:492-494: `clip_text`, a trimming overrun behaviour or autowrap zeroes the
  // text's width contribution, since a narrower box trims or wraps it. The icon still counts.
  const overrunBehavior = props.overrunBehavior ?? OverrunBehavior.NO_TRIMMING;
  const autowrapMode = clampAutowrapMode(props.autowrapMode, AutowrapMode.OFF);
  if (props.clipText || overrunBehavior !== OverrunBehavior.NO_TRIMMING || autowrapMode !== AutowrapMode.OFF) {
    textSize.x = 0;
  }

  let width = textSize.x;
  let height = textSize.y;

  const iconAlignment = props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT;
  const verticalIconAlignment = props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER;
  const iconMaxWidth = n.constants.icon_max_width ?? 0;
  const hSeparation = n.constants.h_separation ?? ctx.theme.separation;

  // A `null` `n.textureSize` is an icon still resolving, which contributes nothing yet.
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

  return { x: marginX + width, y: marginY + height };
};
