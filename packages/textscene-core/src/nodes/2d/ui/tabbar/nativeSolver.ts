/**
 * TabBar's native (WebGL canvas) rect solver AND draw-time tab layout —
 * `TabBar::get_minimum_size` (`scene/gui/tab_bar.cpp:44-122`),
 * `TabBar::get_tab_width` (`:1754-1804`) and `TabBar::_update_cache`
 * (`:1196-1291`). `TabContainer`'s own internal tab strip
 * (`../tabcontainer/nativeSolver.ts`) reuses `computeTabBarDrawLayout` and the
 * theme helpers below directly — one tab-layout implementation, not two that
 * could drift.
 *
 * `right_button` (`set_tab_button_icon`) is never modelled: it is reachable
 * only from script (`tabbar/linterParser.ts`'s own doc), so a `.tscn`-sourced
 * tab never carries one and every `right_button`-guarded branch in the
 * source is dead code here.
 *
 * `nativeTheme.ts` cannot be extended from this slice (this packet's own
 * brief) — `tabBarStyleBoxes` below derives TabBar's OWN `tab_selected`/
 * `tab_unselected`/`tab_disabled`/`tab_hovered` StyleBoxFlat structs directly
 * from `default_theme.cpp:974-992`, reconstructing the project's theme scale
 * from `theme.fontSize` exactly as `spinbox/nativeSolver.ts`'s
 * `reconstructThemeScale` and `progressbar/nativeSolver.ts`'s twin already
 * do. `button_highlight`/`button_pressed` need no such reconstruction: both
 * are literally `make_flat_stylebox(style_normal_color)` /
 * `make_flat_stylebox(style_pressed_color)` (`default_theme.cpp:138-139`),
 * the SAME construction `nativeTheme.ts` already built for Button's own
 * `normal`/`pressed` (`:239,241`), so `theme.widgets.button.normal`/`.pressed`
 * stand in exactly rather than being re-derived.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext, TextureSlotRequest, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { AutowrapMode, isTextLayoutResult, shapeText, shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { resolveTextTheme, type ResolvedTextTheme, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import { fitIconSize } from '../../../../r3f/controls/native/buttonBase';
import { DEFAULT_FONT_SIZE } from '../../../../r3f/controls/godotDefaultTheme';
import type { ControlColor } from '../control/types';
import type { TabBarProperties, TabBarTabProperties } from './types';
import { TAB_BAR_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';

// --- Draw state ---------------------------------------------------------------

export type TabDrawState = 'selected' | 'unselected' | 'disabled';

/**
 * `TabBar::get_tab_width`/`_notification(DRAW)`'s state pick, minus the
 * `hover` arm: a static previewer has no pointer, so that branch never taken
 * (`buttonBase.ts`'s own precedent for `ButtonDrawState`).
 */
export function resolveTabDrawState(tab: Pick<TabBarTabProperties, 'disabled'>, index: number, currentTab: number): TabDrawState {
  if (tab.disabled) return 'disabled';
  if (index === currentTab) return 'selected';
  return 'unselected';
}

// --- Theme: TabBar's own StyleBoxes -------------------------------------------

/** `Color(1, 1, 1, 0.75)` — `style_focus_color` (`default_theme.cpp:117`), `style_tab_selected`'s own top border (`:975-976`). */
const TAB_SELECTED_BORDER_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 0.75 };
/** `Color(0.175, 0.175, 0.175, 1)` — `style_popup_border_color` (`default_theme.cpp:119`), `style_tab_unselected`'s own left/right border (`:981`), inherited by `tab_disabled`/`tab_hovered`. */
const TAB_UNSELECTED_BORDER_COLOR: ControlColor = { r: 0.175, g: 0.175, b: 0.175, a: 1 };
/** `style_pressed_color` (`default_theme.cpp:115`) — `style_tab_unselected`'s own fill (`:977`). */
const TAB_UNSELECTED_FILL: ControlColor = { r: 0, g: 0, b: 0, a: 0.6 };
/** `style_disabled_color` (`default_theme.cpp:116`) — `style_tab_disabled`'s own fill, `duplicate()`'s `set_bg_color` (`:983`). */
const TAB_DISABLED_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };
/** `style_normal_color` (`default_theme.cpp:112`) — `style_tab_selected`'s own fill (`:974`). */
const TAB_SELECTED_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.6 };
/** `Color(0.1, 0.1, 0.1, 0.3)` literal — `style_tab_hovered`'s own fill (`default_theme.cpp:985`), distinct from `TAB_DISABLED_FILL` even though the numbers coincide. */
const TAB_HOVERED_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * `spinbox/nativeSolver.ts`'s `reconstructThemeScale`: `theme.fontSize` is
 * `Math.round(DEFAULT_FONT_SIZE * scale)`, so dividing back out recovers the
 * project's `gui/theme/default_theme_scale` closely enough to reproduce every
 * OTHER `Math.round(literal * scale)` this slice needs — `nativeTheme.ts`
 * exposes no raw `scale` field and cannot be extended from here.
 */
export function reconstructThemeScale(theme: Pick<NativeTheme, 'fontSize'>): number {
  return theme.fontSize / DEFAULT_FONT_SIZE;
}

/**
 * `make_flat_stylebox` restricted to what `StyleBoxFlatData` models —
 * `nativeTheme.ts`'s own private `flatStyleBox` helper, re-derived here since
 * it is not exported and this slice cannot import it.
 */
function flatBox(
  bgColor: ControlColor,
  marginLeft: number,
  marginTop: number,
  marginRight: number,
  marginBottom: number,
  cornerRadius: number,
  scale: number
): StyleBoxFlatData {
  return {
    bgColor,
    borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
    borderWidth: ZERO_SIDES,
    cornerRadius: {
      topLeft: Math.round(cornerRadius * scale),
      topRight: Math.round(cornerRadius * scale),
      bottomRight: Math.round(cornerRadius * scale),
      bottomLeft: Math.round(cornerRadius * scale),
    },
    expandMargin: ZERO_SIDES,
    contentMargin: {
      left: Math.round(marginLeft * scale),
      top: Math.round(marginTop * scale),
      right: Math.round(marginRight * scale),
      bottom: Math.round(marginBottom * scale),
    },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

export interface TabBarStyleBoxes {
  selected: StyleBoxFlatData;
  unselected: StyleBoxFlatData;
  disabled: StyleBoxFlatData;
  hovered: StyleBoxFlatData;
}

/**
 * `default_theme.cpp:974-985`: `style_tab_selected` and `style_tab_unselected`
 * are both `make_flat_stylebox(color, 10, 4, 10, 4, 0)` (margins
 * left/right=10, top/bottom=4, corner radius 0), then EACH gets its own
 * border set directly (bypassing the scaled-margin helper for the border
 * WIDTH, which is scaled separately right beside it): selected's top border
 * is `round(2 * scale)` in `TAB_SELECTED_BORDER_COLOR`; unselected's
 * left+right border is `round(scale)` (i.e. `round(1 * scale)`) in
 * `TAB_UNSELECTED_BORDER_COLOR`. `tab_disabled`/`tab_hovered` are
 * `style_tab_unselected->duplicate()` with only `bg_color` overwritten
 * (`:982-985`), so they inherit unselected's margins/corner/border verbatim.
 */
export function tabBarStyleBoxes(scale: number): TabBarStyleBoxes {
  const selected = flatBox(TAB_SELECTED_FILL, 10, 4, 10, 4, 0, scale);
  selected.borderWidth = { left: 0, top: Math.round(2 * scale), right: 0, bottom: 0 };
  selected.borderColor = TAB_SELECTED_BORDER_COLOR;

  const unselectedBorder = Math.round(1 * scale);
  const unselected = flatBox(TAB_UNSELECTED_FILL, 10, 4, 10, 4, 0, scale);
  unselected.borderWidth = { left: unselectedBorder, top: 0, right: unselectedBorder, bottom: 0 };
  unselected.borderColor = TAB_UNSELECTED_BORDER_COLOR;

  const disabled = { ...unselected, bgColor: TAB_DISABLED_FILL };
  const hovered = { ...unselected, bgColor: TAB_HOVERED_FILL };

  return { selected, unselected, disabled, hovered };
}

/** `overrides['tab_<state>']` (`theme_override_styles/tab_<state>`) wins; else the default-theme struct for that state. */
export function pickTabStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: TabBarStyleBoxes,
  state: TabDrawState
): StyleBoxFlatData {
  return overrides[`tab_${state}`] ?? defaults[state];
}

/**
 * `TabBar::get_tab_width`'s WIDTH-only style pick (`:1761-1768`) — distinct
 * from what actually draws (`pickTabStyleBox`, used by `_notification(DRAW)`
 * itself): for a non-current, non-disabled tab it ALWAYS compares
 * `tab_hovered`'s own minimum width against `tab_unselected`'s and keeps the
 * WIDER one, even though `tab_unselected` is what draws (a static previewer
 * never hovers) — Godot's own comment: "Always pick the widest style between
 * hovered and unselected, to avoid an infinite loop when switching tabs with
 * the mouse." Only WIDTH measurement (`_update_cache`) reads this.
 */
export function tabWidthStyleMinWidth(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: TabBarStyleBoxes,
  state: TabDrawState
): number {
  const minWidth = (box: StyleBoxFlatData) => box.contentMargin.left + box.contentMargin.right;
  if (state !== 'unselected') return minWidth(pickTabStyleBox(overrides, defaults, state));
  return Math.max(minWidth(pickTabStyleBox(overrides, defaults, 'unselected')), minWidth(overrides.tab_hovered ?? defaults.hovered));
}

// --- Theme: font + icon colour ------------------------------------------------

export const TAB_BAR_THEME_FONT_KEY = 'font';

/** `default_theme.cpp:1041-1047`: ONE `font_size` key for every state; a DIFFERENT colour key per state. */
export const TAB_BAR_THEME_KEYS: Record<TabDrawState, TextThemeKeys> = {
  selected: { sizeKey: 'font_size', colorKey: 'font_selected_color' },
  unselected: { sizeKey: 'font_size', colorKey: 'font_unselected_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** `control_font_hover_color` = `Color(0.95, 0.95, 0.95)` (`default_theme.cpp:104`) — `font_selected_color`'s own default (`:1044`). */
const TAB_BAR_SELECTED_FONT_COLOR: ControlColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 };
/** `control_font_low_color` = `Color(0.7, 0.7, 0.7)` (`default_theme.cpp:103`) — `font_unselected_color`'s own default (`:1046`). */
const TAB_BAR_UNSELECTED_FONT_COLOR: ControlColor = { r: 0.7, g: 0.7, b: 0.7, a: 1 };
/** `control_font_disabled_color = control_font_color * Color(1,1,1,0.5)` (`default_theme.cpp:106`) — `font_disabled_color`'s own default (`:1047`). */
const TAB_BAR_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const TAB_BAR_FONT_DEFAULTS: Record<TabDrawState, ControlColor> = {
  selected: TAB_BAR_SELECTED_FONT_COLOR,
  unselected: TAB_BAR_UNSELECTED_FONT_COLOR,
  disabled: TAB_BAR_DISABLED_FONT_COLOR,
};

/** Resolves TabBar's own theme font size/colour for `state` (`resolveTextTheme`'s own doc). */
export function tabBarTextTheme(
  n: SolveNode,
  props: Pick<TabBarProperties, 'themeOverrideFontSizes'>,
  state: TabDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  return resolveTextTheme(n, props, TAB_BAR_THEME_KEYS[state], {
    fontSizePx: ctx.theme.fontSize,
    color: TAB_BAR_FONT_DEFAULTS[state],
  });
}

const TAB_BAR_ICON_COLOR_KEYS: Record<TabDrawState, string> = {
  selected: 'icon_selected_color',
  unselected: 'icon_unselected_color',
  disabled: 'icon_disabled_color',
};

/** `default_theme.cpp:1051-1054`: all four icon-colour states default `Color(1, 1, 1, 1)` — TabBar never dims a tab's icon by state, unlike its font. */
const TAB_BAR_DEFAULT_ICON_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

export function tabBarIconColor(colors: SolveNode['colors'], state: TabDrawState): ControlColor {
  return colors[TAB_BAR_ICON_COLOR_KEYS[state]] ?? TAB_BAR_DEFAULT_ICON_COLOR;
}

// --- Texture slots: one per tab icon -------------------------------------------

/** TabBar's own themeable icons — `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, TabBar, <field>, "<name>")` (`tab_bar.cpp:2160-2182`). */
const TAB_BAR_THEME_ICON_NAMES = ['close', 'increment', 'decrement'] as const;
type TabBarThemeIconName = (typeof TAB_BAR_THEME_ICON_NAMES)[number];

/**
 * One `TextureSlotRequest` per tab whose `icon` ref is non-empty (keyed by
 * tab index — `buildSolveTree.ts`'s generic single-slot fallback only models
 * ONE texture-bearing property per node, and TabBar's icons are an indexed
 * family the generic path cannot see), plus one per THEMED close/increment/
 * decrement icon `SolveNode.icons` resolved.
 */
export const tabBarTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => {
  const tabs = (node.properties as TabBarProperties).tabs ?? [];
  const requests: TextureSlotRequest[] = [];
  tabs.forEach((tab, i) => {
    if (tab.icon) requests.push({ key: String(i), ref: tab.icon });
  });
  for (const name of TAB_BAR_THEME_ICON_NAMES) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/** This tab's icon natural size from `n.textureSlots` — `null` before it resolves or when the tab carries no icon. */
export function tabIconNaturalSize(n: Pick<SolveNode, 'textureSlots'>, index: number): Vec2 | null {
  return n.textureSlots[String(index)] ?? null;
}

/** The vendored default's own size (`native/themeIcons.ts`'s `TAB_BAR_ICON_SIZE`, 16x16 square) for every close/increment/decrement icon alike. */
const TAB_BAR_VENDORED_ICON_SIZE: Vec2 = { x: TAB_BAR_ICON_SIZE, y: TAB_BAR_ICON_SIZE };

/** `close`/`increment`/`decrement`'s resolved size — themed if `SolveNode.textureSlots` resolved it, else the vendored default. */
export function tabBarThemeIconSize(n: Pick<SolveNode, 'textureSlots'>, name: TabBarThemeIconName): Vec2 {
  return n.textureSlots[name] ?? TAB_BAR_VENDORED_ICON_SIZE;
}

// --- Per-tab natural width -----------------------------------------------------

/**
 * `TabBar::get_tab_width` (`:1769,1799-1801`) and the per-tab body of
 * `get_minimum_size` (`:71-106`) compute this SAME formula — style's own
 * minimum width, plus icon, plus text, plus the close button, each gated by
 * presence and separated by ONE `h_separation`, with a trailing separation
 * removed when anything beyond the style's own minimum was added.
 */
export function tabContentWidth(input: {
  styleMinWidth: number;
  iconWidth: number | null;
  hSeparation: number;
  textWidthPx: number;
  hasText: boolean;
  closeVisible: boolean;
  closeIconWidth: number;
  closeButtonMarginLeft: number;
}): number {
  const { styleMinWidth, iconWidth, hSeparation, textWidthPx, hasText, closeVisible, closeIconWidth, closeButtonMarginLeft } = input;
  let x = styleMinWidth;
  if (iconWidth !== null) x += iconWidth + hSeparation;
  if (hasText) x += textWidthPx + hSeparation;
  if (closeVisible) x += closeButtonMarginLeft + closeIconWidth + hSeparation;
  if (x > styleMinWidth) x -= hSeparation;
  return x;
}

/** `cb_displaypolicy == SHOW_ALWAYS || (SHOW_ACTIVE_ONLY && index == current)` (`tab_bar.cpp:84,715,780,1793`). 0 NEVER, 1 ACTIVE_ONLY, 2 ALWAYS. */
export function isCloseButtonVisible(policy: number, index: number, currentTab: number): boolean {
  return policy === 2 || (policy === 1 && index === currentTab);
}

// --- Shaped text (natural, untruncated) ----------------------------------------

/** TabBar never wraps and sets no `line_spacing` on `text_buf` — the same shape `buttonBase.ts`'s `shapeButtonLabel` establishes, spelled out directly since TabBar is not a Button. */
export function shapeTabLabel(text: string, fontSizePx: number, fontMetrics: Parameters<typeof shapeText>[1]['fontMetrics']): TextLayoutResult {
  return shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics });
}

export { isTextLayoutResult };

/** This node's own registered `MinimumSizeFn` meta — one shaped layout per tab, `undefined` where a tab has no text or text was not shaped (no measurer yet). */
export interface TabBarMinimumSizeMeta {
  layouts: readonly (TextLayoutResult | null)[];
}

export function isTabBarMinimumSizeMeta(value: unknown): value is TabBarMinimumSizeMeta {
  return typeof value === 'object' && value !== null && Array.isArray((value as TabBarMinimumSizeMeta).layouts);
}

// --- get_minimum_size -----------------------------------------------------------

/**
 * `TabBar::get_minimum_size` (`tab_bar.cpp:44-122`). A hidden tab (`tab_bar.h`'s
 * own `Tab::hidden` — never authored on a standalone TabBar, but TabContainer's
 * OWN `tab_<idx>/hidden` override reaches this same tabs array when this
 * function is reused for its internal strip) contributes nothing at all.
 *
 * `clip_tabs` overrides the summed width entirely with the WIDEST single
 * tab's own contribution plus the scroll arrows (`:117-119`) — not the
 * `max_tab_width` PROPERTY, which this function never reads (only
 * `_update_cache`'s draw-time truncation does).
 */
export const tabBarMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as TabBarProperties;
  const tabs = props.tabs ?? [];
  const currentTab = props.currentTab ?? -1;
  const closeDisplayPolicy = props.tabCloseDisplayPolicy ?? 0;
  const hSeparation = n.constants.h_separation ?? ctx.theme.separation;
  const iconMaxWidth = n.constants.icon_max_width ?? 0;
  const closeButtonMarginLeft = ctx.theme.widgets.button.normal.contentMargin.left;

  if (tabs.length === 0) return { x: 0, y: 0 };

  const scale = reconstructThemeScale(ctx.theme);
  const defaults = tabBarStyleBoxes(scale);
  const overrides = n.styleBoxes;
  const unselectedBox = pickTabStyleBox(overrides, defaults, 'unselected');
  const selectedBox = pickTabStyleBox(overrides, defaults, 'selected');
  const disabledBox = pickTabStyleBox(overrides, defaults, 'disabled');
  const hoveredBox = overrides.tab_hovered ?? defaults.hovered;
  const yMargin = Math.max(
    unselectedBox.contentMargin.top + unselectedBox.contentMargin.bottom,
    selectedBox.contentMargin.top + selectedBox.contentMargin.bottom,
    disabledBox.contentMargin.top + disabledBox.contentMargin.bottom,
    hoveredBox.contentMargin.top + hoveredBox.contentMargin.bottom
  );

  const fontMetrics = resolveNodeFontMetrics(n, TAB_BAR_THEME_FONT_KEY);
  const layouts: (TextLayoutResult | null)[] = [];
  const closeIconSize = tabBarThemeIconSize(n, 'close');

  let width = 0;
  let height = 0;
  let maxSingleTabWidth = 0;

  tabs.forEach((tab, i) => {
    if (tab.hidden) {
      layouts.push(null);
      return;
    }
    const state = resolveTabDrawState(tab, i, currentTab);
    const style = pickTabStyleBox(overrides, defaults, state);
    const styleMinWidth = style.contentMargin.left + style.contentMargin.right;

    const iconNatural = tabIconNaturalSize(n, i);
    const iconSize = iconNatural ? fitIconSize(iconNatural, iconMaxWidth) : null;
    if (iconSize) height = Math.max(height, iconSize.y + yMargin);

    const hasText = tab.title.length > 0;
    // `text_buf->get_size().y` (`:82`) folds into height UNCONDITIONALLY —
    // even an empty title still shapes one line at the font's own metrics —
    // while the width contribution below is gated on `!is_empty()`.
    const layout = ctx.measureText ? shapeTabLabel(tab.title, ctx.theme.fontSize, fontMetrics) : null;
    layouts.push(layout);
    const textWidth = layout ? shapedTextSizeWidthPx(layout.widthPx) : 0;
    height = Math.max(height, (layout?.heightPx ?? 0) + yMargin);

    const closeVisible = isCloseButtonVisible(closeDisplayPolicy, i, currentTab);
    if (closeVisible) height = Math.max(height, closeIconSize.y + yMargin);

    const tabWidth = tabContentWidth({
      styleMinWidth,
      iconWidth: iconSize ? iconSize.x : null,
      hSeparation,
      textWidthPx: textWidth,
      hasText,
      closeVisible,
      closeIconWidth: closeIconSize.x,
      closeButtonMarginLeft,
    });

    width += tabWidth;
    if (i < tabs.length - 1) width += n.constants.tab_separation ?? 0;
    maxSingleTabWidth = Math.max(maxSingleTabWidth, tabWidth);
  });

  const clipTabs = props.clipTabs ?? true;
  if (clipTabs) {
    const scrollButtonsWidth =
      tabs.length > 1 ? tabBarThemeIconSize(n, 'increment').x + tabBarThemeIconSize(n, 'decrement').x : 0;
    width = maxSingleTabWidth + scrollButtonsWidth;
  }

  return { size: { x: width, y: height }, meta: { layouts } satisfies TabBarMinimumSizeMeta };
};

controlSolverRegistry.registerMinimumSize('TabBar', tabBarMinimumSize);
controlSolverRegistry.registerTextureSlots('TabBar', tabBarTextureSlots);

// --- Draw-time layout: _update_cache -------------------------------------------

export interface TabLayoutInput {
  disabled: boolean;
  hidden: boolean;
  /** Natural (untruncated) content width — `tabContentWidth` at this tab's own state/icon/text. */
  naturalWidth: number;
  /** Natural (untruncated) text width alone, 0 when this tab has no title. */
  naturalTextWidth: number;
}

export interface TabLayoutItem {
  index: number;
  ofs: number;
  /** `size_cache` — possibly truncated by `maxTabWidthPx`. */
  width: number;
  /** The text glyph budget after truncation, in px — equals the tab's natural text width when not truncated. */
  textBudgetPx: number;
  truncated: boolean;
}

export interface TabBarDrawLayout {
  /** Every non-hidden tab between `offset`/`maxDrawnTab` inclusive — a hidden tab is omitted entirely, matching `if (tabs[i].hidden) continue`. */
  items: readonly TabLayoutItem[];
  offset: number;
  maxDrawnTab: number;
  missingRight: boolean;
  buttonsVisible: boolean;
}

/** `TabBar::AlignmentMode` (`tab_bar.h:43-47`). No `FILL`: only LEFT/CENTER/RIGHT exist on the real enum — the brief mentioning a fourth does not match the source. */
export const TAB_ALIGNMENT_LEFT = 0;
export const TAB_ALIGNMENT_CENTER = 1;
export const TAB_ALIGNMENT_RIGHT = 2;

/**
 * `TabBar::_update_cache` (`tab_bar.cpp:1196-1291`), `offset` fixed at 0 (not
 * serialised — `tab_bar.h:106`'s own member default, and nothing in this
 * previewer ever scrolls it).
 *
 * `maxTabWidthPx > 0` truncates a tab whose natural width exceeds it
 * (`:1215-1223`): `mw = max(sizeTextless, maxTabWidthPx)`, `textBudgetPx =
 * max(mw - sizeTextless, 1)`. The GLYPH-level ellipsis Godot's `TextLine`
 * then draws inside that budget (`OVERRUN_TRIM_ELLIPSIS`, its own default) is
 * not reproduced — `label/nativeSolver.ts`'s own `clip`/`overrun_behavior`
 * doc is the precedent; the painter clips the run to `textBudgetPx` instead.
 */
export function computeTabBarDrawLayout(
  tabs: readonly TabLayoutInput[],
  barWidthPx: number,
  alignment: number,
  clipTabs: boolean,
  maxTabWidthPx: number,
  tabSeparation: number,
  incrementIconWidth: number,
  // Defaults to `incrementIconWidth` — `tabcontainer/nativeSolver.ts` reuses
  // this function (module doc) and still calls it with one scroll-icon width;
  // TabBar's own `Component.tsx`, whose increment/decrement icons can now be
  // themed to DIFFERENT sizes, passes both explicitly.
  decrementIconWidth: number = incrementIconWidth
): TabBarDrawLayout {
  if (tabs.length === 0) {
    return { items: [], offset: 0, maxDrawnTab: 0, missingRight: false, buttonsVisible: false };
  }

  const limit = barWidthPx;
  const limitMinusButtons = limit - incrementIconWidth - decrementIconWidth;

  const ofsCache = new Array<number>(tabs.length).fill(0);
  const sizeCache = new Array<number>(tabs.length).fill(0);
  const textBudget = new Array<number>(tabs.length).fill(0);
  const truncated = new Array<boolean>(tabs.length).fill(false);

  let w = 0;
  let maxDrawnTab = tabs.length - 1;

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i]!;
    let size = tab.naturalWidth;
    let text = tab.naturalTextWidth;
    if (maxTabWidthPx > 0 && size > maxTabWidthPx) {
      truncated[i] = true;
      const sizeTextless = size - text;
      const mw = Math.max(sizeTextless, maxTabWidthPx);
      text = Math.max(mw - sizeTextless, 1);
      size = sizeTextless + text;
    }
    sizeCache[i] = size;
    textBudget[i] = text;

    ofsCache[i] = w;
    if (tab.hidden) continue;

    w += size;

    if (clipTabs && i > 0 && w > limit) {
      ofsCache[i] = 0;
      w -= size;
      w -= tabSeparation;
      maxDrawnTab = i - 1;
      while (w > limitMinusButtons && maxDrawnTab > 0) {
        ofsCache[maxDrawnTab] = 0;
        if (!tabs[maxDrawnTab]!.hidden) {
          w -= sizeCache[maxDrawnTab]!;
          w -= tabSeparation;
        }
        maxDrawnTab--;
      }
      break;
    } else if (i < tabs.length - 1) {
      w += tabSeparation;
    }
  }

  const missingRight = maxDrawnTab < tabs.length - 1;
  const buttonsVisible = missingRight;

  if (alignment !== TAB_ALIGNMENT_LEFT) {
    if (alignment === TAB_ALIGNMENT_CENTER) {
      w = ((buttonsVisible ? limitMinusButtons : limit) - w) / 2;
    } else if (alignment === TAB_ALIGNMENT_RIGHT) {
      w = (buttonsVisible ? limitMinusButtons : limit) - w;
    }
    for (let i = 0; i <= maxDrawnTab; i++) {
      if (tabs[i]!.hidden) continue;
      ofsCache[i] = w;
      w += sizeCache[i]! + tabSeparation;
    }
  }

  const items: TabLayoutItem[] = [];
  for (let i = 0; i <= maxDrawnTab; i++) {
    if (tabs[i]!.hidden) continue;
    items.push({ index: i, ofs: ofsCache[i]!, width: sizeCache[i]!, textBudgetPx: textBudget[i]!, truncated: truncated[i]! });
  }

  return { items, offset: 0, maxDrawnTab, missingRight, buttonsVisible };
}

/** `TabBar::_get_tab_icon_size` (`:1806-1826`), restricted to the theme-constant clamp: a per-tab `icon_max_width` is `set_tab_icon_max_width`-only (script, never serialised), always 0. */
export { fitIconSize as fitTabIconSize };

export { contentMarginSize };

// --- Per-tab content placement: _draw_tab ---------------------------------------

export interface TabContentLayout {
  icon: { rect: Rect2 } | null;
  text: { offset: Vec2 } | null;
  close: { rect: Rect2; iconOffset: Vec2 } | null;
}

/**
 * `TabBar::_draw_tab` (`tab_bar.cpp:643-738`), minus `right_button` (dead —
 * see this module's own header) and the hover/pressed background the close
 * button's OWN `button_hl_style`/`button_pressed_style` draws only on
 * interaction (never statically — the close ICON itself still draws
 * unconditionally, `:734`, which is what `close` below positions).
 *
 * `textAdvanceWidthPx` is `tabs[i].size_text` — the (possibly truncated) DRAW
 * width the pen advances by, distinct from the text's own NATURAL width used
 * for centring nothing (Godot centres by HEIGHT only).
 *
 * Under `rtl` the pen starts at `tabWidthPx - contentMargin.left` (`:660` —
 * the LEFT margin measured from the tab's RIGHT edge, never the right one)
 * and each element is placed at `p_x - its own width` before the pen steps
 * back by that width plus one `h_separation` (`:668,671,676,684,721`).
 * Vertical placement is direction-independent.
 */
export function layoutTabContent(input: {
  barHeightPx: number;
  style: StyleBoxFlatData;
  /** `tabs[p_index].size_cache` — the drawn tab's own width, the RTL pen's origin. */
  tabWidthPx: number;
  iconSize: Vec2 | null;
  hasText: boolean;
  textNaturalHeightPx: number;
  textAdvanceWidthPx: number;
  hSeparation: number;
  closeVisible: boolean;
  closeIconSize: Vec2;
  buttonHlMargin: { left: number; top: number; right: number; bottom: number };
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`) — flows the content from the tab's trailing edge. */
  rtl: boolean;
}): TabContentLayout {
  const { style, barHeightPx, hSeparation, rtl } = input;
  const innerHeight = barHeightPx - (style.contentMargin.top + style.contentMargin.bottom);

  let x = rtl ? input.tabWidthPx - style.contentMargin.left : style.contentMargin.left;
  let icon: TabContentLayout['icon'] = null;
  if (input.iconSize) {
    const y = style.contentMargin.top + (innerHeight - input.iconSize.y) / 2;
    icon = { rect: { x: rtl ? x - input.iconSize.x : x, y, w: input.iconSize.x, h: input.iconSize.y } };
    x = rtl ? x - input.iconSize.x - hSeparation : x + input.iconSize.x + hSeparation;
  }

  let text: TabContentLayout['text'] = null;
  if (input.hasText) {
    const y = style.contentMargin.top + (innerHeight - input.textNaturalHeightPx) / 2;
    text = { offset: { x: rtl ? x - input.textAdvanceWidthPx : x, y } };
    x = rtl ? x - input.textAdvanceWidthPx - hSeparation : x + input.textAdvanceWidthPx + hSeparation;
  }

  let close: TabContentLayout['close'] = null;
  if (input.closeVisible) {
    const w = input.buttonHlMargin.left + input.buttonHlMargin.right + input.closeIconSize.x;
    const h = input.buttonHlMargin.top + input.buttonHlMargin.bottom + input.closeIconSize.y;
    const y = style.contentMargin.top + (innerHeight - h) / 2;
    const cbX = rtl ? x - w : x;
    close = {
      rect: { x: cbX, y, w, h },
      iconOffset: { x: cbX + input.buttonHlMargin.left, y: y + input.buttonHlMargin.top },
    };
  }

  return { icon, text, close };
}

/**
 * A drawn tab's own x inside the bar — `_notification(DRAW)`'s two
 * `_draw_tab` calls and `TabBar::get_tab_rect` (`tab_bar.cpp:552,561,1929,1931`),
 * which agree exactly. `ofsPx` is the LTR-space `ofs_cache`
 * `computeTabBarDrawLayout` produces; `_update_cache` itself never reads the
 * layout direction.
 */
export function tabDrawX(ofsPx: number, tabWidthPx: number, barWidthPx: number, rtl: boolean): number {
  return rtl ? barWidthPx - ofsPx - tabWidthPx : ofsPx;
}

// --- Scroll arrows --------------------------------------------------------------

export interface ScrollArrowPlacement {
  x: number;
  y: number;
  /** `Color(1, 1, 1, 0.5)` rather than full opacity. */
  dim: boolean;
}

export interface ScrollArrowsLayout {
  decrement: ScrollArrowPlacement;
  increment: ScrollArrowPlacement;
}

/**
 * `TabBar::_notification(DRAW)`'s `buttons_visible` block
 * (`tab_bar.cpp:564-592`). `offset` never scrolls above 0 here
 * (`computeTabBarDrawLayout`'s own doc), so whichever arrow scrolls TOWARDS
 * the start is always dim and `missing_right` alone lights the other one.
 * RTL puts the pair against the LEFT edge and swaps those roles, and places
 * the increment icon at the INCREMENT icon's own width (`:575`) where LTR
 * steps by the DECREMENT icon's (`:587`) — the two differ only under a theme
 * that sizes them differently.
 *
 * `vofs` is an `int` measured off the INCREMENT icon's height for BOTH arrows
 * (`:565`), so an odd leftover truncates rather than landing on a half pixel.
 */
export function layoutScrollArrows(input: {
  barWidthPx: number;
  barHeightPx: number;
  incrementIconSize: Vec2;
  decrementIconSize: Vec2;
  missingRight: boolean;
  rtl: boolean;
}): ScrollArrowsLayout {
  const { barWidthPx, incrementIconSize, decrementIconSize, missingRight, rtl } = input;
  const y = Math.trunc((input.barHeightPx - incrementIconSize.y) / 2);
  if (rtl) {
    return {
      decrement: { x: 0, y, dim: !missingRight },
      increment: { x: incrementIconSize.x, y, dim: true },
    };
  }
  const limitMinusButtons = barWidthPx - incrementIconSize.x - decrementIconSize.x;
  return {
    decrement: { x: limitMinusButtons, y, dim: true },
    increment: { x: limitMinusButtons + decrementIconSize.x, y, dim: !missingRight },
  };
}
