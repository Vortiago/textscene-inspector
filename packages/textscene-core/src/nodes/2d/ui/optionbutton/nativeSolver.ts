/**
 * OptionButton's native (WebGL canvas) rect solver + content-layout math —
 * `OptionButton::get_minimum_size`/`_refresh_size_cache`/`_notification`
 * (`scene/gui/option_button.cpp`) and the theme defaults
 * `scene/theme/default_theme.cpp:212-251` registers under type name
 * `"OptionButton"`. Registered via `controlSolverRegistry.registerMinimumSize`.
 *
 * OptionButton reuses Button's ordinary 2-state draw-state resolution
 * (`buttonBase.ts`'s `resolveButtonDrawState`/`pickButtonStyleBox`) — unlike
 * CheckBox, its "pressed" concept is whether the POPUP is open
 * (`OptionButton::pressed`), which a static preview never reaches, so
 * `get_draw_mode()` only ever selects `DRAW_NORMAL`/`DRAW_DISABLED` here.
 *
 * Its own StyleBox chrome IS a real fill (`sb_optbutton_normal/hover/pressed/
 * disabled`, `default_theme.cpp:212-215`) with `2*default_margin` horizontal /
 * `default_margin` vertical content margins — DIFFERENT numbers from Button's
 * own uniform margin, already exposed as `theme.optionButtonMarginX/Y`
 * (`godotDefaultTheme.ts`) precisely so this module never re-derives them.
 * `optionButtonStyleBoxes` only ASSEMBLES a `StyleBoxFlatData` from those
 * already-scaled numbers plus `theme.styleFill` (mirroring, not importing,
 * `nativeTheme.ts`'s own private `flatStyleBox` helper — `NativeTheme` has no
 * `widgets.optionButton` entry of its own, so this module builds its OWN
 * rather than adding one there).
 *
 * The chevron arrow is NEVER run through `Button::_fit_icon_size`/
 * `icon_max_width` (`OptionButton::get_minimum_size`/`_notification` read
 * `theme_cache.arrow_icon->get_size()`/`get_width()`/`get_height()` directly)
 * and reserves its space via Button's OWN `_internal_margin` mechanism exactly
 * like CheckBox's check icon does on the LEFT — `buttonBase.ts`'s
 * `layoutButtonContent` does not model that, so this module ports the
 * text/arrow placement math itself. The reservation's `h_separation`
 * component only ever affects the RIGHT internal margin here — LEFT stays
 * unset (OptionButton never reserves left-side space), so Button's own
 * `left_internal_margin_with_h_separation` term is always zero and the
 * LEFT-aligned text offset below never needs it: it drops straight out of
 * the general formula, not a simplification this port introduces.
 *
 * Pure data + functions, no THREE/React — painting is `NativeComponent.tsx`'s job.
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
  originCorrectionPx,
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
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import type { ControlColor } from '../control/types';
import type { OptionButtonProperties } from './types';

// Re-exported so NativeComponent.tsx can build on the shared, Button-generic
// pieces without importing `buttonBase.ts` a second time under a different name.
export { originCorrectionPx, pickButtonStyleBox, resolveButtonDrawState, tintColor };
export type { ButtonDrawState };

/**
 * OptionButton's own theme font key — `SceneStringName(font)` = `"font"`,
 * `scene/theme/default_theme.cpp:237`:
 * `theme->set_font(SceneStringName(font), "OptionButton", Ref<Font>());`.
 * Fed to `resolveNodeFontMetrics` by both this module and `Component.tsx` so
 * the two agree on which font this OptionButton is in.
 */
export const OPTION_BUTTON_THEME_FONT_KEY = 'font';

// --- Theme font colours --------------------------------------------------------

/** `control_font_color` (`default_theme.cpp:101`), OptionButton's own `font_color` default (`:240`). */
export const OPTION_BUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`:106`), OptionButton's own `font_disabled_color` default (`:245`). */
export const OPTION_BUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const OPTION_BUTTON_THEME_KEYS: Record<ButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** Resolves OptionButton's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / OptionButton's own literal — `resolveTextTheme`'s own doc). */
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

// --- StyleBox chrome -------------------------------------------------------------

// OptionButton's `normal`/`disabled` chrome (`default_theme.cpp:212-215`) is
// precomputed once per theme as `theme.widgets.optionButton`, so the solve and
// the paint read the SAME struct instances. Building it per call instead would
// hand `StyleBoxQuad` a fresh identity every render and rebuild its
// `BufferGeometry` each time.

// --- Selected item ---------------------------------------------------------------

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

// --- Arrow -------------------------------------------------------------------------

/** `option_button_arrow.svg`'s own authored size (`native/themeIcons.ts`), 12x12 — NEVER run through `_fit_icon_size`. */
export const OPTION_BUTTON_ARROW_NATURAL_SIZE: Vec2 = { x: 12, y: 12 };

function optionButtonHSeparation(props: OptionButtonProperties, ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, props.themeOverrideConstants?.h_separation ?? ctx.theme.separation);
}

// --- Minimum size ----------------------------------------------------------------

/**
 * `OptionButton::get_minimum_size` (`option_button.cpp:50-68`), with
 * `fit_to_longest_item` (default `true`, `option_button.h`, never modelled as
 * settable false since this codebase's parser exposes no such property) —
 * `_refresh_size_cache`'s own per-item max (`:451-458`) folded in directly:
 * the width/height floor is the WIDEST/TALLEST item's own text size, not the
 * currently-selected item's, unioned with the stylebox's own bare minimum
 * (`theme_cache.normal->get_minimum_size()`). The arrow's width + `h_separation`
 * then adds UNCONDITIONALLY (no "only if there is text" guard — contrast
 * `CheckBox::get_minimum_size`'s `if (content_size.width > 0 …)`, which
 * OptionButton's own source simply does not have).
 */
export const optionButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as OptionButtonProperties;
  const state = resolveButtonDrawState(props.disabled);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.optionButton, state);
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
      textW = Math.max(textW, size.x);
      textH = Math.max(textH, size.y);
    }
  }

  const hSeparation = optionButtonHSeparation(props, ctx);
  const arrow = OPTION_BUTTON_ARROW_NATURAL_SIZE;

  const width = marginX + textW + arrow.x + hSeparation;
  const height = marginY + Math.max(textH, arrow.y);

  return { x: width, y: height };
};

// --- Content layout (text + arrow placement) --------------------------------------

export interface OptionButtonContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** The CURRENT draw-state StyleBox's content margins. */
  styleMargin: { left: number; top: number; right: number; bottom: number };
  arrowSize: Vec2;
  /** `arrow_margin` theme constant — measured from the FULL rect edge, not the content-margin edge. */
  arrowMargin: number;
  /** The shaped (selected item's) text natural size — `(0, 0)` when there is no selection. */
  textNaturalSize: Vec2;
  fontSizePx: number;
  /** This OptionButton's OWN resolved font (`resolveNodeFontMetrics(n, OPTION_BUTTON_THEME_FONT_KEY)`) — gates `originCorrectionPx`'s atlas-bake correction (`fontMetrics.ts`'s `kind` discriminant). Required rather than defaulted: an omitted value silently applying the atlas correction to a scene font is exactly the defect this field closes. */
  fontMetrics: Pick<FontMetrics, 'kind'>;
}

export interface OptionButtonContentLayout {
  /** LOCAL to the control's own top-left, Godot px. */
  arrowRect: Rect2;
  /** Pen-origin top-left, LOCAL Godot px, ALREADY including `originCorrectionPx`. Always returned — the caller decides whether there is text worth drawing at this offset. */
  textOffset: Vec2;
}

/**
 * `OptionButton::_notification`'s arrow `ofs` (`option_button.cpp:113-121`,
 * RTL omitted) plus Button's OWN internal-margin text reservation
 * (`button.cpp:247-260,444-456`) specialised to OptionButton's fixed
 * right-arrow/left-text arrangement: `_internal_margin[SIDE_RIGHT]` is always
 * the arrow's width (`option_button.cpp:83-89`), so the reserved gap before
 * the text's right edge is `arrowSize.x + h_separation` — but the arrow's OWN
 * draw position never reads the stylebox margin at all, only `arrow_margin`
 * against the FULL control size.
 */
export function layoutOptionButtonContent(input: OptionButtonContentInput): OptionButtonContentLayout {
  const { rectSize, styleMargin, arrowSize, arrowMargin, textNaturalSize, fontSizePx, fontMetrics } = input;

  const arrowRect: Rect2 = {
    x: Math.floor(rectSize.x - arrowSize.x - arrowMargin),
    y: Math.floor(Math.abs((rectSize.y - arrowSize.y) / 2)),
    w: arrowSize.x,
    h: arrowSize.y,
  };

  const customElementHeight = rectSize.y - styleMargin.top - styleMargin.bottom;
  const textOffset: Vec2 = {
    x: styleMargin.left,
    y: (customElementHeight - textNaturalSize.y) / 2 + styleMargin.top + originCorrectionPx(fontSizePx, fontMetrics),
  };

  return { arrowRect, textOffset };
}
