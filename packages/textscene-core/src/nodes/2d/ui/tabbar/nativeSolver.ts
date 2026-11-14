/**
 * TabBar's native (WebGL canvas) tab rules and theme helpers: `TabBar::get_tab_width`
 * (`scene/gui/tab_bar.cpp:1754-1804`), `_update_cache` (`:1196-1291`) and `_draw_tab` (`:643-738`).
 * `minimumSize.ts` ports `get_minimum_size` from them. TabContainer's internal strip draws through
 * the TabBar component, so it shares `computeTabBarDrawLayout` and the theme helpers.
 * `right_button` (`set_tab_button_icon`) is script-only, so no `.tscn` tab carries one and it is
 * not modelled.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TextureSlotRequest, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import type { ShareNode, SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontSizePx } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { fitIconSize } from '../../../../r3f/controls/native/buttonBase';
import type { TabBarProperties, TabBarTabProperties } from './types';
import { scaledIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import { TAB_BAR_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import { AutowrapMode, TextDirection } from '../../../../godot/text/textServerEnums';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import {
  controlBidiOptions,
  type ControlTextEnv,
} from '../../../../r3f/controls/native/text/textBidiOptions';

export type TabDrawState = 'selected' | 'unselected' | 'disabled';

/**
 * `TabBar::get_tab_width`/`_notification(DRAW)`'s state pick, minus the `hover`
 * arm: a static previewer has no pointer.
 */
export function resolveTabDrawState(
  tab: Pick<TabBarTabProperties, 'disabled'>,
  index: number,
  currentTab: number
): TabDrawState {
  if (tab.disabled) return 'disabled';
  if (index === currentTab) return 'selected';
  return 'unselected';
}

/** The `tab_<state>` box the tab draws. */
export function pickTabStyleBox(
  styleBoxes: SolveNode['styleBoxes'],
  state: TabDrawState | 'hovered'
): StyleBoxFlatData {
  return requiredThemeItem(styleBoxes, `tab_${state}`);
}

/**
 * `TabBar::get_tab_width`'s width-only style pick (`:1761-1768`), apart from the
 * drawn one (`pickTabStyleBox`): a non-current, enabled tab takes the wider of
 * `tab_hovered` and `tab_unselected` "to avoid an infinite loop when switching tabs
 * with the mouse" (Godot's comment). Only `_update_cache` reads it.
 */
export function tabWidthStyleMinWidth(styleBoxes: SolveNode['styleBoxes'], state: TabDrawState): number {
  const minWidth = (box: StyleBoxFlatData) => box.contentMargin.left + box.contentMargin.right;
  if (state !== 'unselected') return minWidth(pickTabStyleBox(styleBoxes, state));
  return Math.max(
    minWidth(pickTabStyleBox(styleBoxes, 'unselected')),
    minWidth(pickTabStyleBox(styleBoxes, 'hovered'))
  );
}

export const TAB_BAR_THEME_FONT_KEY = 'font';

/** `BIND_THEME_ITEM(Theme::DATA_TYPE_FONT_SIZE, TabBar, font_size)` (`tab_bar.cpp:2179`): one size item for every state. */
export const TAB_BAR_THEME_FONT_SIZE_KEY = 'font_size';

/** One colour key per state, unlike the single size key. */
const TAB_BAR_FONT_COLOR_KEYS: Record<TabDrawState, string> = {
  selected: 'font_selected_color',
  unselected: 'font_unselected_color',
  disabled: 'font_disabled_color',
};

/**
 * The size each tab's `text_buf` is shaped at: `theme_cache.font_size` (`tab_bar.cpp:365`),
 * where a local `theme_override_font_sizes/font_size` wins (`control.cpp:3113-3129`).
 * The solver and the painter both call this, since Godot shapes once per tab for
 * both the minimum size (`:82`) and the draw (`:677`).
 */
export function tabBarFontSizePx(
  n: ShareNode,
  props: Pick<TabBarProperties, 'themeOverrideFontSizes'>
): number {
  return resolveNodeFontSizePx(
    n,
    TAB_BAR_THEME_FONT_SIZE_KEY,
    props.themeOverrideFontSizes?.[TAB_BAR_THEME_FONT_SIZE_KEY]
  );
}

/** This tab state's font colour: the resolved `font_<state>_color` (`n.colors`). */
export function tabBarFontColor(colors: SolveNode['colors'], state: TabDrawState): Rgba {
  return requiredThemeItem(colors, TAB_BAR_FONT_COLOR_KEYS[state]);
}

const TAB_BAR_ICON_COLOR_KEYS: Record<TabDrawState, string> = {
  selected: 'icon_selected_color',
  unselected: 'icon_unselected_color',
  disabled: 'icon_disabled_color',
};

/** The table's four `TabBar/icon_*_color` are opaque white, so no state dims the icon by default. */
export function tabBarIconColor(colors: SolveNode['colors'], state: TabDrawState): Rgba {
  return requiredThemeItem(colors, TAB_BAR_ICON_COLOR_KEYS[state]);
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
  return [...requests, ...themedSlotRequests(TAB_BAR_THEME_ICON_NAMES, themedIcons)];
};

/** This tab's icon natural size from `n.textureSlots`: `null` before it resolves or when the tab carries no icon. */
export function tabIconNaturalSize(n: Pick<SolveNode, 'textureSlots'>, index: number): Vector2 | null {
  return n.textureSlots[String(index)] ?? null;
}

/** `close`/`increment`/`decrement`'s resolved size: themed if `SolveNode.textureSlots` resolved it, else the vendored default (`native/themeIcons.ts`'s `TAB_BAR_ICON_SIZE`, a 16x16 square for all three) at `scale`. */
export function tabBarThemeIconSize(
  n: Pick<SolveNode, 'textureSlots'>,
  name: TabBarThemeIconName,
  scale: number
): Vector2 {
  if (n.textureSlots[name]) return n.textureSlots[name];
  const side = scaledIconSize(TAB_BAR_ICON_SIZE, scale);
  return { x: side, y: side };
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
  const {
    styleMinWidth,
    iconWidth,
    hSeparation,
    textWidthPx,
    hasText,
    closeVisible,
    closeIconWidth,
    closeButtonMarginLeft,
  } = input;
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

/** A tab's own `text_direction` and `language`, which no scene sets (`tab_bar.h:77`): the layout direction and the locale. */
const TAB_TITLE_BIDI = { textDirection: TextDirection.TEXT_DIRECTION_INHERITED, language: '' };

/**
 * Natural, untruncated text: TabBar never wraps and sets no `line_spacing` on `text_buf`, like
 * `buttonBase.ts`'s `shapeButtonLabel`, but TabBar is not a Button. `_shape` takes the layout
 * direction (`tab_bar.cpp:358-362`).
 */
export function shapeTabLabel(
  text: string,
  env: ControlTextEnv,
  font: { fontSizePx: number; fontMetrics?: FontMetrics }
): TextLayoutResult {
  return shapeText(text, {
    ...controlBidiOptions(TAB_TITLE_BIDI, env),
    ...font,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
  });
}

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
  /** The first drawn tab: `TabBar::offset`. */
  offset: number;
  maxDrawnTab: number;
  missingRight: boolean;
  buttonsVisible: boolean;
}

/** `TabBar::AlignmentMode` (`tab_bar.h:43-47`): LEFT, CENTER and RIGHT, with no `FILL`. */
export const TAB_ALIGNMENT_LEFT = 0;
export const TAB_ALIGNMENT_CENTER = 1;
export const TAB_ALIGNMENT_RIGHT = 2;

export interface TabBarLayoutInput {
  barWidthPx: number;
  alignment: number;
  clipTabs: boolean;
  /** `max_width`: 0 leaves a tab untruncated. */
  maxTabWidthPx: number;
  tabSeparation: number;
  incrementIconWidth: number;
  decrementIconWidth: number;
  /** `TabBar::current`, -1 for none. */
  currentTab: number;
  /** `scroll_to_selected` (`tab_bar.h:132`). */
  scrollToSelected: boolean;
  /** The first drawn tab, when the caller already ran the load sequence (`tabcontainer/loadStrip.ts`). */
  offset?: number;
}

/** `_update_cache`'s per-tab `size_cache` and `size_text` (`tab_bar.cpp:1211-1223`), truncated by `max_width`. */
export type TabSize = Pick<TabLayoutItem, 'width' | 'textBudgetPx' | 'truncated'>;

/**
 * `maxTabWidthPx > 0` truncates a wider tab (`:1215-1223`) to
 * `textBudgetPx = max(max(sizeTextless, maxTabWidthPx) - sizeTextless, 1)`.
 */
export function measureTabSizes(tabs: readonly TabLayoutInput[], maxTabWidthPx: number): TabSize[] {
  return tabs.map((tab) => {
    const truncated = maxTabWidthPx > 0 && tab.naturalWidth > maxTabWidthPx;
    if (!truncated) return { width: tab.naturalWidth, textBudgetPx: tab.naturalTextWidth, truncated };
    const sizeTextless = tab.naturalWidth - tab.naturalTextWidth;
    const textBudgetPx = Math.max(Math.max(sizeTextless, maxTabWidthPx) - sizeTextless, 1);
    return { width: sizeTextless + textBudgetPx, textBudgetPx, truncated };
  });
}

/** `limit_minus_buttons` (`tab_bar.cpp:1203`): the width left beside the two scroll arrows. */
function widthBesideArrows(input: TabBarLayoutInput): number {
  return input.barWidthPx - input.incrementIconWidth - input.decrementIconWidth;
}

export interface TabPlacement {
  /** `ofs_cache` after alignment: 0 for a tab outside `offset..maxDrawnTab`. */
  ofs: number[];
  maxDrawnTab: number;
  missingRight: boolean;
  buttonsVisible: boolean;
}

/**
 * `_update_cache` (`tab_bar.cpp:1225-1290`) for a strip that starts at tab `offset`. Once the strip
 * has scrolled, the arrows take room from the budget, so the budget is the smaller
 * `limitMinusButtons` (never above `limit`, as an icon width is not negative).
 */
export function placeTabs(
  tabs: readonly TabLayoutInput[],
  sizes: readonly TabSize[],
  input: TabBarLayoutInput,
  offset: number
): TabPlacement {
  const { barWidthPx: limit, alignment, clipTabs, tabSeparation } = input;
  const limitMinusButtons = widthBesideArrows(input);
  const budget = offset > 0 ? limitMinusButtons : limit;
  const ofs = new Array<number>(tabs.length).fill(0);
  let w = 0;
  let maxDrawnTab = tabs.length - 1;

  for (let i = offset; i < tabs.length; i++) {
    ofs[i] = w;
    if (tabs[i]!.hidden) continue;

    w += sizes[i]!.width;

    if (clipTabs && i > offset && w > budget) {
      ofs[i] = 0;
      w -= sizes[i]!.width;
      w -= tabSeparation;
      maxDrawnTab = i - 1;
      while (w > limitMinusButtons && maxDrawnTab > offset) {
        ofs[maxDrawnTab] = 0;
        if (!tabs[maxDrawnTab]!.hidden) {
          w -= sizes[maxDrawnTab]!.width;
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
  const buttonsVisible = offset > 0 || missingRight;

  if (alignment !== TAB_ALIGNMENT_LEFT) {
    const room = buttonsVisible ? limitMinusButtons : limit;
    // `w` is an int in Godot (`:1273`): an odd leftover truncates, not a half pixel.
    w = alignment === TAB_ALIGNMENT_CENTER ? Math.trunc((room - w) / 2) : room - w;
    for (let i = offset; i <= maxDrawnTab; i++) {
      if (tabs[i]!.hidden) continue;
      ofs[i] = w;
      w += sizes[i]!.width + tabSeparation;
    }
  }

  return { ofs, maxDrawnTab, missingRight, buttonsVisible };
}

/**
 * `TabBar::ensure_tab_visible` (`tab_bar.cpp:1875-1920`): the `offset` that brings `currentTab` into view
 * from a strip that starts at `offset`. It reads the aligned `ofs_cache` and adds no `tab_separation`,
 * as Godot does. A hidden tab ends no pass early, so `offset` counts only the tabs it steps past.
 */
export function ensureTabVisible(
  tabs: readonly TabLayoutInput[],
  sizes: readonly TabSize[],
  placement: TabPlacement,
  offset: number,
  input: TabBarLayoutInput
): number {
  const { currentTab } = input;
  const isInRange = currentTab >= offset && currentTab <= placement.maxDrawnTab;
  const isUnknownTab = currentTab < 0 || currentTab >= tabs.length;
  if (isUnknownTab || !placement.buttonsVisible || tabs[currentTab]!.hidden || isInRange) return offset;
  if (currentTab < offset) return currentTab;

  const limitMinusButtons = widthBesideArrows(input);
  let totalWidth = placement.ofs[placement.maxDrawnTab]! - placement.ofs[offset]!;
  for (let i = placement.maxDrawnTab; i <= currentTab; i++) {
    if (!tabs[i]!.hidden) totalWidth += sizes[i]!.width;
  }
  let scrolledOffset = offset;
  for (let i = offset; i < currentTab; i++) {
    if (tabs[i]!.hidden) continue;
    if (totalWidth <= limitMinusButtons) break;
    totalWidth -= sizes[i]!.width;
    scrolledOffset++;
  }
  return scrolledOffset;
}

/**
 * `TabBar::_ensure_no_over_offset` (`tab_bar.cpp:1827-1860`): the `offset` that pulls the strip back
 * while the tabs before it still fit, so no room is left empty beside the arrows.
 */
export function ensureNoOverOffset(
  tabs: readonly TabLayoutInput[],
  sizes: readonly TabSize[],
  placement: TabPlacement,
  offset: number,
  input: TabBarLayoutInput
): number {
  if (!placement.buttonsVisible) return offset;
  const { maxDrawnTab, ofs } = placement;
  const limitWithButtons = widthBesideArrows(input);
  let offsetWithButtons = offset;
  let offsetWithNoButton = offset;
  let totalWidth = ofs[maxDrawnTab]! + sizes[maxDrawnTab]!.width - ofs[offset]!;
  for (let i = offset - 1; i >= 0; i--) {
    if (!tabs[i]!.hidden) totalWidth += sizes[i]!.width;
    if (totalWidth < limitWithButtons) {
      offsetWithButtons--;
      offsetWithNoButton--;
    } else if (totalWidth < input.barWidthPx) {
      offsetWithNoButton--;
    } else {
      break;
    }
  }
  return offsetWithNoButton === 0 ? 0 : offsetWithButtons;
}

/**
 * A TabBar node's `offset` once its scene has loaded: `ensure_tab_visible` runs once when the bar enters
 * the tree (`tab_bar.cpp:401`), at the width the scene gave it. Hidden tabs are TabContainer-only.
 */
function ensureTabVisibleOnLoad(
  tabs: readonly TabLayoutInput[],
  sizes: readonly TabSize[],
  input: TabBarLayoutInput
): number {
  if (!input.scrollToSelected) return 0;
  return ensureTabVisible(tabs, sizes, placeTabs(tabs, sizes, input, 0), 0, input);
}

/**
 * `TabBar::_update_cache` (`tab_bar.cpp:1196-1291`) as a loaded scene leaves it. `offset` is not
 * serialised (`tab_bar.h:106`), so the load sequence decides it: `ensureTabVisibleOnLoad`. The painter places the
 * close button and trims the title from `textBudgetPx`.
 */
export function computeTabBarDrawLayout(
  tabs: readonly TabLayoutInput[],
  input: TabBarLayoutInput
): TabBarDrawLayout {
  if (tabs.length === 0) {
    return { items: [], offset: 0, maxDrawnTab: 0, missingRight: false, buttonsVisible: false };
  }

  const sizes = measureTabSizes(tabs, input.maxTabWidthPx);
  const offset = input.offset ?? ensureTabVisibleOnLoad(tabs, sizes, input);
  const placement = placeTabs(tabs, sizes, input, offset);

  const { ofs, maxDrawnTab, missingRight, buttonsVisible } = placement;
  const items: TabLayoutItem[] = [];
  for (let i = offset; i <= maxDrawnTab; i++) {
    if (tabs[i]!.hidden) continue;
    items.push({ index: i, ofs: ofs[i]!, ...sizes[i]! });
  }

  return { items, offset, maxDrawnTab, missingRight, buttonsVisible };
}

/** `TabBar::_get_tab_icon_size` (`:1806-1826`), restricted to the theme-constant clamp: a per-tab `icon_max_width` is `set_tab_icon_max_width`-only (script, never serialised), always 0. */
export { fitIconSize as fitTabIconSize };

export interface TabContentLayout {
  icon: { rect: Rect2 } | null;
  text: { offset: Vector2 } | null;
  close: { rect: Rect2; iconOffset: Vector2 } | null;
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
  iconSize: Vector2 | null;
  hasText: boolean;
  textNaturalHeightPx: number;
  /** `tabs[i].size_text`: the draw width the pen advances by, possibly truncated. */
  textAdvanceWidthPx: number;
  hSeparation: number;
  closeVisible: boolean;
  closeIconSize: Vector2;
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

interface ScrollArrowPlacement {
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
 * `TabBar::_notification(DRAW)`'s `buttons_visible` block (`tab_bar.cpp:564-592`). The arrow toward
 * the start lights when `offset > 0` and the one toward the end when `missing_right`. RTL puts the
 * pair at the left edge, swaps those roles, and steps by the increment icon's width (`:575`) where
 * LTR uses the decrement's (`:587`).
 */
export function layoutScrollArrows(input: {
  barWidthPx: number;
  barHeightPx: number;
  incrementIconSize: Vector2;
  decrementIconSize: Vector2;
  missingRight: boolean;
  /** `offset > 0`: tabs sit before the first drawn one. */
  canScrollBack: boolean;
  rtl: boolean;
}): ScrollArrowsLayout {
  const { barWidthPx, incrementIconSize, decrementIconSize, missingRight, canScrollBack, rtl } = input;
  // `vofs` is an `int` off the increment icon's height for both arrows (`:565`),
  // so an odd leftover truncates rather than landing on a half pixel.
  const y = Math.trunc((input.barHeightPx - incrementIconSize.y) / 2);
  if (rtl) {
    return {
      decrement: { x: 0, y, dim: !missingRight },
      increment: { x: incrementIconSize.x, y, dim: !canScrollBack },
    };
  }
  const limitMinusButtons = barWidthPx - incrementIconSize.x - decrementIconSize.x;
  return {
    decrement: { x: limitMinusButtons, y, dim: !canScrollBack },
    increment: { x: limitMinusButtons + decrementIconSize.x, y, dim: !missingRight },
  };
}
