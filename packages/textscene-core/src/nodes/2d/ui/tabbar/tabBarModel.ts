/**
 * Everything about a TabBar's tabs that does not depend on its width, as two shares
 * (`solveHandoff.ts`): the facts the minimum size reads with no text measured, and the model that
 * adds each shaped title. The painter draws the model, and the layout of a Control that holds a
 * TabBar, such as TabContainer's, replays the bar's load events against it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rgba } from '../../../../godot/math/math';
import type { Vector2 } from '../../../../godot/math/vector';
import { defineShare } from '../../../../r3f/controls/native/solveHandoff';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { isTabUnselectable, resolveTabBarCurrentTab } from './currentTab';
import {
  TAB_ALIGNMENT_LEFT,
  TAB_BAR_THEME_FONT_KEY,
  fitTabIconSize,
  isCloseButtonVisible,
  pickTabStyleBox,
  resolveTabDrawState,
  shapeTabLabel,
  tabBarFontColor,
  tabBarFontSizePx,
  tabBarIconColor,
  tabBarThemeIconSize,
  tabContentWidth,
  tabIconNaturalSize,
  tabWidthStyleMinWidth,
  type TabBarLayoutInput,
  type TabDrawState,
  type TabLayoutInput,
} from './nativeSolver';
import type { TabBarProperties, TabBarTabProperties } from './types';

const NO_TABS: readonly TabBarTabProperties[] = [];

/** One tab as its theme and properties give it, before its title is shaped. */
export interface TabFacts {
  properties: TabBarTabProperties;
  state: TabDrawState;
  /** The `tab_<state>` box the tab draws. */
  style: StyleBoxFlatData;
  /** The style width `get_tab_width` reads (`tabWidthStyleMinWidth`), not always the drawn box's. */
  naturalStyleWidth: number;
  iconSize: Vector2 | null;
  closeVisible: boolean;
  fontColor: Rgba;
  iconColor: Rgba;
}

/** The TabBar's tabs and the theme items its minimum size and its draw read. */
export interface TabBarFacts {
  tabs: readonly TabFacts[];
  hSeparation: number;
  closeButtonMargin: StyleBoxFlatData['contentMargin'];
  closeIconSize: Vector2;
  incrementIconSize: Vector2;
  decrementIconSize: Vector2;
  /** The largest vertical content margin of the four tab boxes (`tab_bar.cpp:47-50`). */
  yMargin: number;
  fontSizePx: number;
  fontMetrics: FontMetrics | undefined;
  layoutInput: Omit<TabBarLayoutInput, 'barWidthPx' | 'offset'>;
  isStyleFlipped: boolean;
}

/** A tab's two widths for a title `textWidthPx` wide. */
export interface TabWidths {
  /** `TabBar::get_minimum_size`'s width: the box of the tab's state (`tab_bar.cpp:60-70`). */
  minimumWidth: number;
  /** `TabBar::get_tab_width`: the wider of `tab_hovered` and `tab_unselected` for an unselected tab (`:1757-1768`). */
  naturalWidth: number;
}

/** One tab as it is shaped and sized, before the bar's width places it. */
export interface ComputedTab extends TabFacts, TabWidths {
  layout: TextLayoutResult;
  naturalTextWidth: number;
}

/** The facts with every title shaped. */
export interface TabBarModel extends TabBarFacts {
  computed: readonly ComputedTab[];
  drawInputs: readonly TabLayoutInput[];
}

export const tabBarFacts = defineShare((solveNode, theme): TabBarFacts => {
  const props = solveNode.node.properties as TabBarProperties;
  const tabs = props.tabs ?? NO_TABS;
  const currentTab = resolveTabBarCurrentTab(props.currentTab, props.deselectEnabled, tabs.length, (i) =>
    isTabUnselectable(tabs[i]!)
  );
  const closeDisplayPolicy = props.tabCloseDisplayPolicy ?? 0;
  const iconMaxWidth = requiredThemeItem(solveNode.constants, 'icon_max_width');
  const { styleBoxes, colors } = solveNode;
  const incrementIconSize = tabBarThemeIconSize(solveNode, 'increment', theme.scale);
  const decrementIconSize = tabBarThemeIconSize(solveNode, 'decrement', theme.scale);

  return {
    tabs: tabs.map((tab, i): TabFacts => {
      const state = resolveTabDrawState(tab, i, currentTab);
      // A disabled current tab draws its disabled box in the selected colours (`tab_bar.cpp:556-561`).
      const colourState = i === currentTab ? 'selected' : state;
      const iconNatural = tabIconNaturalSize(solveNode, i);
      return {
        properties: tab,
        state,
        style: pickTabStyleBox(styleBoxes, state),
        naturalStyleWidth: tabWidthStyleMinWidth(styleBoxes, state),
        iconSize: iconNatural ? fitTabIconSize(iconNatural, iconMaxWidth) : null,
        closeVisible: isCloseButtonVisible(closeDisplayPolicy, i, currentTab),
        fontColor: tabBarFontColor(colors, colourState),
        iconColor: tabBarIconColor(colors, colourState),
      };
    }),
    hSeparation: requiredThemeItem(solveNode.constants, 'h_separation'),
    // `_get_tab_width` pads the close button by `button_hl_style`'s margins (`tab_bar.cpp:89-100`).
    closeButtonMargin: requiredThemeItem(styleBoxes, 'button_highlight').contentMargin,
    closeIconSize: tabBarThemeIconSize(solveNode, 'close', theme.scale),
    incrementIconSize,
    decrementIconSize,
    yMargin: Math.max(
      ...(['unselected', 'selected', 'disabled', 'hovered'] as const).map(
        (state) => contentMarginSize(pickTabStyleBox(styleBoxes, state)).y
      )
    ),
    fontSizePx: tabBarFontSizePx(solveNode, props),
    fontMetrics: resolveNodeFontMetrics(solveNode, TAB_BAR_THEME_FONT_KEY),
    layoutInput: {
      alignment: props.tabAlignment ?? TAB_ALIGNMENT_LEFT,
      clipTabs: props.clipTabs ?? true,
      maxTabWidthPx: props.maxTabWidth ?? 0,
      tabSeparation: solveNode.constants.tab_separation ?? 0,
      incrementIconWidth: incrementIconSize.x,
      decrementIconWidth: decrementIconSize.x,
      currentTab,
      scrollToSelected: props.scrollToSelected ?? true,
    },
    isStyleFlipped: props.tabStyleVFlip === true,
  };
});

/** Tab `facts` with a title `textWidthPx` wide on a style `styleMinWidth` wide, by the one formula of `tabContentWidth`. */
function tabWidthAt(bar: TabBarFacts, facts: TabFacts, styleMinWidth: number, textWidthPx: number): number {
  return tabContentWidth({
    styleMinWidth,
    iconWidth: facts.iconSize ? facts.iconSize.x : null,
    hSeparation: bar.hSeparation,
    textWidthPx,
    hasText: facts.properties.title.length > 0,
    closeVisible: facts.closeVisible,
    closeIconWidth: bar.closeIconSize.x,
    closeButtonMarginLeft: bar.closeButtonMargin.left,
  });
}

/** The width `get_minimum_size` gives tab `facts` with a title `textWidthPx` wide. */
export function tabMinimumWidth(bar: TabBarFacts, facts: TabFacts, textWidthPx: number): number {
  const { left, right } = facts.style.contentMargin;
  return tabWidthAt(bar, facts, left + right, textWidthPx);
}

function tabWidths(bar: TabBarFacts, facts: TabFacts, textWidthPx: number): TabWidths {
  return {
    minimumWidth: tabMinimumWidth(bar, facts, textWidthPx),
    naturalWidth: tabWidthAt(bar, facts, facts.naturalStyleWidth, textWidthPx),
  };
}

/** The TabBar's tabs, measured, with the theme items its draw reads. */
export const tabBarModel = defineShare((solveNode, theme): TabBarModel => {
  const bar = tabBarFacts(solveNode, theme);
  const font = { fontSizePx: bar.fontSizePx, fontMetrics: bar.fontMetrics };
  const computed = bar.tabs.map((facts): ComputedTab => {
    const layout = shapeTabLabel(facts.properties.title, solveNode, font);
    const naturalTextWidth = shapedTextSizeWidthPx(layout.widthPx);
    return {
      ...facts,
      ...tabWidths(bar, facts, naturalTextWidth),
      layout,
      naturalTextWidth,
    };
  });
  return {
    ...bar,
    computed,
    drawInputs: computed.map(({ properties, naturalWidth, naturalTextWidth }) => ({
      disabled: properties.disabled,
      hidden: properties.hidden === true,
      naturalWidth,
      naturalTextWidth,
    })),
  };
});
