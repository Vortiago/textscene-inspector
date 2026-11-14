/**
 * Everything about a TabBar's tabs that does not depend on its width, as one share
 * (`solveHandoff.ts`): its painter draws it, and the layout of a Control that holds a TabBar, such
 * as TabContainer's, replays the bar's load events against it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { defineShare } from '../../../../r3f/controls/native/solveHandoff';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { isTabUnselectable, resolveTabBarCurrentTab } from './currentTab';
import {
  TAB_ALIGNMENT_LEFT,
  TAB_BAR_THEME_FONT_KEY,
  fitTabIconSize,
  isCloseButtonVisible,
  resolveTabDrawState,
  shapeTabLabel,
  tabBarFontSizePx,
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

/** One tab as it is shaped and sized, before the bar's width places it. */
export interface ComputedTab {
  tab: TabBarTabProperties;
  state: TabDrawState;
  iconSize: { x: number; y: number } | null;
  layout: TextLayoutResult;
}

/** The TabBar's tabs, measured, with the theme items its draw reads. */
export const tabBarModel = defineShare((solveNode, theme) => {
  const props = solveNode.node.properties as TabBarProperties;
  const tabs = props.tabs ?? NO_TABS;
  const currentTab = resolveTabBarCurrentTab(props.currentTab, props.deselectEnabled, tabs.length, (i) =>
    isTabUnselectable(tabs[i]!)
  );
  const closeDisplayPolicy = props.tabCloseDisplayPolicy ?? 0;
  const hSeparation = requiredThemeItem(solveNode.constants, 'h_separation');
  const iconMaxWidth = requiredThemeItem(solveNode.constants, 'icon_max_width');
  const styleBoxes = solveNode.styleBoxes;
  const closeButtonMargin = requiredThemeItem(styleBoxes, 'button_highlight').contentMargin;
  const closeIconSize = tabBarThemeIconSize(solveNode, 'close', theme.scale);
  const incrementIconSize = tabBarThemeIconSize(solveNode, 'increment', theme.scale);
  const decrementIconSize = tabBarThemeIconSize(solveNode, 'decrement', theme.scale);
  const fontMetrics = resolveNodeFontMetrics(solveNode, TAB_BAR_THEME_FONT_KEY);
  const fontSizePx = tabBarFontSizePx(solveNode, props);

  const computed: ComputedTab[] = tabs.map((tab, i) => {
    const iconNatural = tabIconNaturalSize(solveNode, i);
    return {
      tab,
      state: resolveTabDrawState(tab, i, currentTab),
      iconSize: iconNatural ? fitTabIconSize(iconNatural, iconMaxWidth) : null,
      layout: shapeTabLabel(tab.title, solveNode, { fontSizePx, fontMetrics }),
    };
  });

  const drawInputs: TabLayoutInput[] = computed.map(({ tab, state, iconSize, layout }, i) => {
    const naturalTextWidth = shapedTextSizeWidthPx(layout.widthPx);
    const naturalWidth = tabContentWidth({
      styleMinWidth: tabWidthStyleMinWidth(styleBoxes, state),
      iconWidth: iconSize ? iconSize.x : null,
      hSeparation,
      textWidthPx: naturalTextWidth,
      hasText: tab.title.length > 0,
      closeVisible: isCloseButtonVisible(closeDisplayPolicy, i, currentTab),
      closeIconWidth: closeIconSize.x,
      closeButtonMarginLeft: closeButtonMargin.left,
    });
    return { disabled: tab.disabled, hidden: tab.hidden === true, naturalWidth, naturalTextWidth };
  });

  const layoutInput: Omit<TabBarLayoutInput, 'barWidthPx' | 'offset'> = {
    alignment: props.tabAlignment ?? TAB_ALIGNMENT_LEFT,
    clipTabs: props.clipTabs ?? true,
    maxTabWidthPx: props.maxTabWidth ?? 0,
    tabSeparation: solveNode.constants.tab_separation ?? 0,
    incrementIconWidth: incrementIconSize.x,
    decrementIconWidth: decrementIconSize.x,
    currentTab,
    scrollToSelected: props.scrollToSelected ?? true,
  };

  return {
    computed,
    drawInputs,
    layoutInput,
    closeDisplayPolicy,
    hSeparation,
    closeButtonMargin,
    closeIconSize,
    incrementIconSize,
    decrementIconSize,
    fontSizePx,
    fontMetrics,
    isStyleFlipped: props.tabStyleVFlip === true,
  };
});
