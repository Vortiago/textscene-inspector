/**
 * TabBar's native (WebGL canvas) rect solver and draw-time tab layout: `TabBar::get_minimum_size`
 * (`scene/gui/tab_bar.cpp:44-122`), `get_tab_width` (`:1754-1804`) and `_update_cache` (`:1196-1291`).
 * TabContainer's internal strip reuses `computeTabBarDrawLayout` and the theme helpers. `right_button`
 * (`set_tab_button_icon`) is script-only, so no `.tscn` tab carries one and it is not modelled.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { SolveContext, TextureSlotRequest, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { AutowrapMode, isTextLayoutResult, shapeText, shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics, resolveNodeFontSizePx } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { fitIconSize } from '../../../../r3f/controls/native/buttonBase';
import { DEFAULT_FONT_SIZE } from '../../../../r3f/controls/godotDefaultTheme';
import type { ControlColor } from '../control/types';
import type { TabBarProperties, TabBarTabProperties } from './types';
import { TAB_BAR_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';

export type TabDrawState = 'selected' | 'unselected' | 'disabled';

/**
 * `TabBar::get_tab_width`/`_notification(DRAW)`'s state pick, minus the `hover`
 * arm: a static previewer has no pointer.
 */
export function resolveTabDrawState(tab: Pick<TabBarTabProperties, 'disabled'>, index: number, currentTab: number): TabDrawState {
  if (tab.disabled) return 'disabled';
  if (index === currentTab) return 'selected';
  return 'unselected';
}

/** `Color(1, 1, 1, 0.75)`: `style_focus_color` (`default_theme.cpp:117`), `style_tab_selected`'s top border (`:975-976`). */
const TAB_SELECTED_BORDER_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 0.75 };
/** `Color(0.175, 0.175, 0.175, 1)`: `style_popup_border_color` (`default_theme.cpp:119`), `style_tab_unselected`'s left and right border (`:981`), inherited by `tab_disabled`/`tab_hovered`. */
const TAB_UNSELECTED_BORDER_COLOR: ControlColor = { r: 0.175, g: 0.175, b: 0.175, a: 1 };
/** `style_pressed_color` (`default_theme.cpp:115`): `style_tab_unselected`'s fill (`:977`). */
const TAB_UNSELECTED_FILL: ControlColor = { r: 0, g: 0, b: 0, a: 0.6 };
/** `style_disabled_color` (`default_theme.cpp:116`): `style_tab_disabled`'s fill, set on the `duplicate()` (`:983`). */
const TAB_DISABLED_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };
/** `style_normal_color` (`default_theme.cpp:112`): `style_tab_selected`'s fill (`:974`). */
const TAB_SELECTED_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.6 };
/** A `Color(0.1, 0.1, 0.1, 0.3)` literal: `style_tab_hovered`'s fill (`default_theme.cpp:985`), apart from `TAB_DISABLED_FILL` although the numbers match. */
const TAB_HOVERED_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * `theme.fontSize` is `Math.round(DEFAULT_FONT_SIZE * scale)`, so dividing back
 * recovers `gui/theme/default_theme_scale` closely enough for every other
 * `Math.round(literal * scale)` here. `nativeTheme.ts` exposes no raw `scale`.
 */
export function reconstructThemeScale(theme: Pick<NativeTheme, 'fontSize'>): number {
  return theme.fontSize / DEFAULT_FONT_SIZE;
}

/**
 * `make_flat_stylebox` restricted to what `StyleBoxFlatData` models: a copy of
 * `nativeTheme.ts`'s private `flatStyleBox`, which is not exported.
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
 * `default_theme.cpp:974-985`: `tab_selected` and `tab_unselected` are
 * `make_flat_stylebox(color, 10, 4, 10, 4, 0)`, each with a border width scaled
 * apart from the margins: `round(2 * scale)` on selected's top, `round(scale)` on
 * unselected's sides. `tab_disabled`/`tab_hovered` duplicate unselected and change only `bg_color` (`:982-985`).
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

/** `overrides['tab_<state>']` (`theme_override_styles/tab_<state>`) wins over the default-theme box for that state. */
export function pickTabStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: TabBarStyleBoxes,
  state: TabDrawState
): StyleBoxFlatData {
  return overrides[`tab_${state}`] ?? defaults[state];
}

/**
 * `TabBar::get_tab_width`'s width-only style pick (`:1761-1768`), apart from the
 * drawn one (`pickTabStyleBox`): a non-current, enabled tab takes the wider of
 * `tab_hovered` and `tab_unselected` "to avoid an infinite loop when switching tabs
 * with the mouse" (Godot's comment). Only `_update_cache` reads it.
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

export const TAB_BAR_THEME_FONT_KEY = 'font';

/** `BIND_THEME_ITEM(Theme::DATA_TYPE_FONT_SIZE, TabBar, font_size)` (`tab_bar.cpp:2179`): one size item for every state, `default_theme.cpp:1041`. */
export const TAB_BAR_THEME_FONT_SIZE_KEY = 'font_size';

/** `default_theme.cpp:1044-1047`: one colour key per state, unlike the single size key. */
const TAB_BAR_FONT_COLOR_KEYS: Record<TabDrawState, string> = {
  selected: 'font_selected_color',
  unselected: 'font_unselected_color',
  disabled: 'font_disabled_color',
};

/** `control_font_hover_color` = `Color(0.95, 0.95, 0.95)` (`default_theme.cpp:104`), the `font_selected_color` default (`:1044`). */
const TAB_BAR_SELECTED_FONT_COLOR: ControlColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 };
/** `control_font_low_color` = `Color(0.7, 0.7, 0.7)` (`default_theme.cpp:103`), the `font_unselected_color` default (`:1046`). */
const TAB_BAR_UNSELECTED_FONT_COLOR: ControlColor = { r: 0.7, g: 0.7, b: 0.7, a: 1 };
/** `control_font_disabled_color = control_font_color * Color(1,1,1,0.5)` (`default_theme.cpp:106`), the `font_disabled_color` default (`:1047`). */
const TAB_BAR_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const TAB_BAR_FONT_DEFAULTS: Record<TabDrawState, ControlColor> = {
  selected: TAB_BAR_SELECTED_FONT_COLOR,
  unselected: TAB_BAR_UNSELECTED_FONT_COLOR,
  disabled: TAB_BAR_DISABLED_FONT_COLOR,
};

/**
 * The size each tab's `text_buf` is shaped at: `theme_cache.font_size` (`tab_bar.cpp:365`),
 * where a local `theme_override_font_sizes/font_size` wins (`control.cpp:3113-3129`).
 * The solver and the painter both call this, since Godot shapes once per tab for
 * both the minimum size (`:82`) and the draw (`:677`).
 */
export function tabBarFontSizePx(
  n: SolveNode,
  props: Pick<TabBarProperties, 'themeOverrideFontSizes'>,
  theme: Pick<NativeTheme, 'fontSize'>
): number {
  return resolveNodeFontSizePx(
    n,
    TAB_BAR_THEME_FONT_SIZE_KEY,
    props.themeOverrideFontSizes?.[TAB_BAR_THEME_FONT_SIZE_KEY],
    theme.fontSize
  );
}

/** This tab state's font colour: the resolved `font_<state>_color` (`n.colors`), else the default theme's literal. */
export function tabBarFontColor(colors: SolveNode['colors'], state: TabDrawState): ControlColor {
  return colors[TAB_BAR_FONT_COLOR_KEYS[state]] ?? TAB_BAR_FONT_DEFAULTS[state];
}

const TAB_BAR_ICON_COLOR_KEYS: Record<TabDrawState, string> = {
  selected: 'icon_selected_color',
  unselected: 'icon_unselected_color',
  disabled: 'icon_disabled_color',
};

/** `default_theme.cpp:1051-1054`: all four icon-colour states default to `Color(1, 1, 1, 1)`, so no state dims the icon. */
const TAB_BAR_DEFAULT_ICON_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

export function tabBarIconColor(colors: SolveNode['colors'], state: TabDrawState): ControlColor {
  return colors[TAB_BAR_ICON_COLOR_KEYS[state]] ?? TAB_BAR_DEFAULT_ICON_COLOR;
}

/** TabBar's themeable icons: `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, TabBar, <field>, "<name>")` (`tab_bar.cpp:2160-2182`). */
const TAB_BAR_THEME_ICON_NAMES = ['close', 'increment', 'decrement'] as const;
type TabBarThemeIconName = (typeof TAB_BAR_THEME_ICON_NAMES)[number];

/**
 * One `TextureSlotRequest` per tab with an `icon`, keyed by tab index, plus one per
 * themed close/increment/decrement icon in `SolveNode.icons`. `buildSolveTree.ts`'s
 * generic path models one texture property per node and cannot see an indexed family.
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

/** This tab's icon natural size from `n.textureSlots`: `null` before it resolves or when the tab carries no icon. */
export function tabIconNaturalSize(n: Pick<SolveNode, 'textureSlots'>, index: number): Vec2 | null {
  return n.textureSlots[String(index)] ?? null;
}

/** The vendored default's own size (`native/themeIcons.ts`'s `TAB_BAR_ICON_SIZE`, 16x16 square) for every close/increment/decrement icon alike. */
const TAB_BAR_VENDORED_ICON_SIZE: Vec2 = { x: TAB_BAR_ICON_SIZE, y: TAB_BAR_ICON_SIZE };

/** `close`/`increment`/`decrement`'s resolved size: themed if `SolveNode.textureSlots` resolved it, else the vendored default. */
export function tabBarThemeIconSize(n: Pick<SolveNode, 'textureSlots'>, name: TabBarThemeIconName): Vec2 {
  return n.textureSlots[name] ?? TAB_BAR_VENDORED_ICON_SIZE;
}

/**
 * `TabBar::get_tab_width` (`:1769,1799-1801`) and `get_minimum_size`'s per-tab body
 * (`:71-106`) share this formula: the style's minimum width plus icon, text and close
 * button, each gated by presence and separated by one `h_separation`. The trailing
 * separation drops when anything was added.
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

/** Natural, untruncated text: TabBar never wraps and sets no `line_spacing` on `text_buf`, like `buttonBase.ts`'s `shapeButtonLabel`, but TabBar is not a Button. */
export function shapeTabLabel(text: string, fontSizePx: number, fontMetrics: Parameters<typeof shapeText>[1]['fontMetrics']): TextLayoutResult {
  return shapeText(text, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics });
}

export { isTextLayoutResult };

/**
 * `TabBar::get_minimum_size` (`tab_bar.cpp:44-122`). A hidden tab contributes nothing
 * (only TabContainer's strip sets `Tab::hidden` in tab_bar.h). `clip_tabs` replaces the
 * summed width with the widest tab plus the scroll arrows (`:117-119`). Only
 * `_update_cache` reads `max_tab_width`.
 */
export const tabBarMinimumSize = (n: SolveNode, ctx: SolveContext): Vec2 => {
  const props = n.node.properties as TabBarProperties;
  const tabs = props.tabs ?? [];
  const currentTab = props.currentTab ?? -1;
  const closeDisplayPolicy = props.tabCloseDisplayPolicy ?? 0;
  const hSeparation = n.constants.h_separation ?? ctx.theme.separation;
  const iconMaxWidth = n.constants.icon_max_width ?? 0;
  // `button_highlight` and `button_pressed` are flat boxes of `style_normal_color` and
  // `style_pressed_color` (`default_theme.cpp:138-139`), the same as Button's `normal` and `pressed`
  // (`:239,241`), so `theme.widgets.button` stands in for them.
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
  const fontSizePx = tabBarFontSizePx(n, props, ctx.theme);
  const closeIconSize = tabBarThemeIconSize(n, 'close');

  let width = 0;
  let height = 0;
  let maxSingleTabWidth = 0;

  tabs.forEach((tab, i) => {
    if (tab.hidden) return;
    const state = resolveTabDrawState(tab, i, currentTab);
    const style = pickTabStyleBox(overrides, defaults, state);
    const styleMinWidth = style.contentMargin.left + style.contentMargin.right;

    const iconNatural = tabIconNaturalSize(n, i);
    const iconSize = iconNatural ? fitIconSize(iconNatural, iconMaxWidth) : null;
    if (iconSize) height = Math.max(height, iconSize.y + yMargin);

    const hasText = tab.title.length > 0;
    // `text_buf->get_size().y` (`:82`) always folds into the height, since an empty
    // title still shapes one line. The width below is gated on `!is_empty()`.
    const layout = ctx.measureText ? shapeTabLabel(tab.title, fontSizePx, fontMetrics) : null;
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

  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('TabBar', tabBarMinimumSize);
controlSolverRegistry.registerTextureSlots('TabBar', tabBarTextureSlots);

export interface TabLayoutInput {
  disabled: boolean;
  hidden: boolean;
  /** Natural (untruncated) content width: `tabContentWidth` at this tab's state, icon and text. */
  naturalWidth: number;
  /** Natural (untruncated) text width alone, 0 when this tab has no title. */
  naturalTextWidth: number;
}

export interface TabLayoutItem {
  index: number;
  ofs: number;
  /** `size_cache`, possibly truncated by `maxTabWidthPx`. */
  width: number;
  /** The text glyph budget after truncation, in px. It equals the natural text width when not truncated. */
  textBudgetPx: number;
  truncated: boolean;
}

export interface TabBarDrawLayout {
  /** Every non-hidden tab from `offset` to `maxDrawnTab` inclusive, matching `if (tabs[i].hidden) continue`. */
  items: readonly TabLayoutItem[];
  offset: number;
  maxDrawnTab: number;
  missingRight: boolean;
  buttonsVisible: boolean;
}

/** `TabBar::AlignmentMode` (`tab_bar.h:43-47`): LEFT, CENTER and RIGHT, with no `FILL`. */
export const TAB_ALIGNMENT_LEFT = 0;
export const TAB_ALIGNMENT_CENTER = 1;
export const TAB_ALIGNMENT_RIGHT = 2;

/**
 * `TabBar::_update_cache` (`tab_bar.cpp:1196-1291`) with `offset` at 0: it is not
 * serialised (`tab_bar.h:106`), and nothing here scrolls it. `maxTabWidthPx > 0` truncates
 * a wider tab (`:1215-1223`) to `textBudgetPx = max(max(sizeTextless, maxTabWidthPx) - sizeTextless, 1)`.
 * The painter clips to that budget in place of Godot's `OVERRUN_TRIM_ELLIPSIS`.
 */
export function computeTabBarDrawLayout(
  tabs: readonly TabLayoutInput[],
  barWidthPx: number,
  alignment: number,
  clipTabs: boolean,
  maxTabWidthPx: number,
  tabSeparation: number,
  incrementIconWidth: number,
  // The default serves `tabcontainer/nativeSolver.ts`, which passes one scroll-icon
  // width. TabBar's `Component.tsx` passes both, since a theme can size them apart.
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

export interface TabContentLayout {
  icon: { rect: Rect2 } | null;
  text: { offset: Vec2 } | null;
  close: { rect: Rect2; iconOffset: Vec2 } | null;
}

/**
 * `TabBar::_draw_tab` (`tab_bar.cpp:643-738`), minus `right_button` and the close
 * button's hover and pressed backgrounds, which draw only on interaction. The close
 * icon always draws (`:734`), and `close` places it. Godot centres by height only.
 */
export function layoutTabContent(input: {
  barHeightPx: number;
  style: StyleBoxFlatData;
  /** `tabs[p_index].size_cache`: the drawn tab's width, the RTL pen's origin. */
  tabWidthPx: number;
  iconSize: Vec2 | null;
  hasText: boolean;
  textNaturalHeightPx: number;
  /** `tabs[i].size_text`: the draw width the pen advances by, possibly truncated. */
  textAdvanceWidthPx: number;
  hSeparation: number;
  closeVisible: boolean;
  closeIconSize: Vec2;
  buttonHlMargin: { left: number; top: number; right: number; bottom: number };
  /**
   * `Control::is_layout_rtl()` (`SolveNode.rtl`). The pen starts at `tabWidthPx - contentMargin.left`
   * (`:660`), and each element sits at `p_x - width` before the pen steps back by that width plus
   * one `h_separation` (`:668,671,676,684,721`). Vertical placement ignores direction.
   */
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
 * A drawn tab's x inside the bar, per `_notification(DRAW)`'s `_draw_tab` calls and
 * `TabBar::get_tab_rect` (`tab_bar.cpp:552,561,1929,1931`). `ofsPx` is the LTR
 * `ofs_cache` from `computeTabBarDrawLayout`: `_update_cache` never reads the direction.
 */
export function tabDrawX(ofsPx: number, tabWidthPx: number, barWidthPx: number, rtl: boolean): number {
  return rtl ? barWidthPx - ofsPx - tabWidthPx : ofsPx;
}

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
 * `TabBar::_notification(DRAW)`'s `buttons_visible` block (`tab_bar.cpp:564-592`).
 * `offset` stays 0, so the arrow toward the start is always dim and `missing_right`
 * lights the other. RTL puts the pair at the left edge, swaps those roles, and steps
 * by the increment icon's width (`:575`) where LTR uses the decrement's (`:587`).
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
  // `vofs` is an `int` off the increment icon's height for both arrows (`:565`),
  // so an odd leftover truncates rather than landing on a half pixel.
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
