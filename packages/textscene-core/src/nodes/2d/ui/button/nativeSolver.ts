/**
 * Button's native (WebGL canvas) rect solver —
 * `Button::get_minimum_size_for_text_and_icon` (`scene/gui/button.cpp:481-526`,
 * called from `get_minimum_size` with an empty `p_text`, which reuses the
 * node's OWN shaped text) — plus the theme-override key mapping
 * (`font_size`/`font_color`/`font_disabled_color`) and the two default
 * colours Button reads. Registered via
 * `controlSolverRegistry.registerMinimumSize`. Pure per-node math, no
 * THREE/React — painting is `Component.tsx`'s job, and the
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
 * Button's own theme font key — `SceneStringName(font)` = `"font"`,
 * `scene/theme/default_theme.cpp:152`:
 * `theme->set_font(SceneStringName(font), "Button", Ref<Font>());`. Fed to
 * `resolveNodeFontMetrics` inside {@link buttonLabelShape}, the one shaping
 * computation both this module and `Component.tsx` call, so the two cannot
 * disagree about which font this Button is in.
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

/** Resolves this Button's icon modulate colour for `state` (`n.colors` — a local override or the ancestor Theme chain — wins, else the default-theme literal above). */
export function buttonIconColor(colors: SolveNode['colors'], state: ButtonDrawState): ControlColor {
  return colors[BUTTON_ICON_COLOR_KEYS[state]] ?? BUTTON_ICON_MODULATE[state];
}

/** Resolves this Button's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / Button's own literal — `resolveTextTheme`'s own doc). */
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
 * Button's shaped label — the **solve handoff** share
 * (`r3f/controls/native/solveHandoff.ts`) `buttonMinimumSize` and
 * `Component.tsx` both call, so one shape serves the minimum size and the
 * pixels.
 *
 * `null` for empty text, which is the ONE case neither side draws.
 * `ctx.measureText` is not consulted here: it is a readiness GATE, and the
 * gate belongs to the solver (`buttonMinimumSize`) — the painter shapes
 * unconditionally, so a share that honoured the gate would answer differently
 * for the two callers.
 *
 * Shapes via `shapeButtonLabel` DIRECTLY rather than through
 * `ctx.measureText`, whose `Vec2`-only return would discard the
 * `TextLayoutResult` the painter needs.
 *
 * A plain function rather than a `defineShare` memo: `boxWidthPx` is a THIRD
 * input, and the memo's `(node, theme)` key cannot express it — a wrapping
 * Button shaped once at the solver's tentative width would then answer the
 * painter with the wrong rows.
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
 * The horizontal space the icon takes out of the label's own box —
 * `drawable_size_remained.width`'s icon term (`button.cpp:332-352`,
 * `layoutButtonContent`'s own `if (iconAlign !== H_CENTER)` branch). Only the
 * wrap width needs it separately from `layoutButtonContent`, which cannot run
 * before the text is shaped.
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
 * `Button::get_minimum_size_for_text_and_icon` (`button.cpp:481-526`), minus
 * `align_to_largest_stylebox` (Button's own default theme sets it to `0` /
 * disabled, `:174`, and this codebase never overrides it) and autowrap sizing
 * (not modelled — see `buttonBase.ts`'s `layoutButtonContent` doc for why).
 *
 * `n.rtl` reaches only the stylebox pick (`:525` sizes off
 * `_get_current_stylebox()`, whose arms prefer `<state>_mirrored`); the icon
 * and text terms read `horizontal_icon_alignment` UNSWAPPED here, and only
 * test it against CENTER, so the side swap cannot move a minimum size.
 *
 * `n.textureSize` is `null` until the icon texture resolves — treated as "no
 * icon contribution yet", the same convention `texturerect/nativeSolver.ts`'s
 * `textureRectMinimumSize` already establishes for an unresolved texture. An
 * absent `ctx.measureText` is treated as "text contributes nothing" rather
 * than the whole function degrading to zero (`solverRegistry.ts`'s own
 * contract) — margin and icon still contribute, since neither depends on
 * text measurement.
 *
 * The shaping itself is {@link buttonLabelShape}, which `Component.tsx` calls
 * too. `ctx.measureText` stays the presence GATE here (`!ctx.measureText`
 * means "text contributes nothing"), so the `TextMeasurer` abstraction still
 * decides whether text shaping runs during a solve.
 */
export const buttonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ButtonProperties;
  const state = resolveButtonDrawState(props.disabled);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.button, state, n.rtl);
  const { x: marginX, y: marginY } = contentMarginSize(styleBox);

  const hasText = (props.text ?? '').length > 0;
  // Pass 2 of the solve (`solverRegistry.ts`'s `tentativeRect`) knows this
  // node's own width, which is what a wrapping label's HEIGHT depends on;
  // pass 1 shapes unwrapped, exactly as `textedit/nativeSolver.ts` does.
  // `is_clipped` is true whenever autowrap is on (`button.cpp:332`), so the
  // icon's reservation never depends on the text and this is not circular.
  const tentative = ctx.tentativeRect?.(n);
  const wrapWidthPx =
    tentative === undefined ? 0 : tentative.w - marginX - buttonIconReservationPx(n, props, ctx);
  const layout: TextLayoutResult | null = ctx.measureText ? buttonLabelShape(n, ctx.theme, wrapWidthPx) : null;
  // `minsize` starts from `paragraph->get_size()` (`button.cpp:492`), a max
  // over `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`)
  // — the CEILED extent, not the raw pen advance.
  const textSize = layout
    ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
    : { x: 0, y: 0 };
  // button.cpp:492-494: `clip_text` or any non-NO_TRIMMING overrun behaviour
  // zeroes the TEXT's own width contribution (the icon's own width, added
  // below, is unaffected) — the box no longer needs to be wide enough for
  // the full label, since a narrower one just trims it.
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
