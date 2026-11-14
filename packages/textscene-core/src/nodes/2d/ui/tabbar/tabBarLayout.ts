/**
 * A TabBar's draw at its solved size, as a rect share (`solveHandoff.ts`): where each drawn tab sits,
 * its trimmed title and the places of its icon, title and close button, and the scroll arrows.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Vector2 } from '../../../../godot/math/vector';
import { defineRectShare } from '../../../../r3f/controls/native/solveHandoff';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { TEXT_LINE_DEFAULT_OVERRUN, trimSoloLine } from '../../../../r3f/controls/native/text/textOverrun';
import {
  computeTabBarDrawLayout,
  layoutScrollArrows,
  layoutTabContent,
  tabDrawX,
  type ScrollArrowsLayout,
  type TabBarDrawLayout,
  type TabContentLayout,
  type TabLayoutItem,
} from './nativeSolver';
import { tabBarModel, type ComputedTab, type TabBarModel } from './tabBarModel';

/** One tab as the bar draws it. */
export interface DrawnTab {
  index: number;
  tab: ComputedTab;
  /** The tab's left edge inside the bar, in the layout direction. */
  x: number;
  width: number;
  /** The title as drawn: trimmed to its budget when `max_tab_width` truncates the tab. */
  label: TextLayoutResult;
  content: TabContentLayout;
}

/** The bar's draw from one first drawn tab. */
export interface TabBarDraw {
  /** The current tab comes last: Godot draws it after the others (`tab_bar.cpp:547-562`). */
  tabs: readonly DrawnTab[];
  /** Null while every tab fits (`buttons_visible`). */
  arrows: ScrollArrowsLayout | null;
}

/** The bar at one size. */
export interface TabBarLayout {
  model: TabBarModel;
  /**
   * The draw from first drawn tab `offset`. Undefined runs the bar's own load, which scrolls to the
   * current tab; a TabContainer replays its own load and passes the offset it reached.
   */
  at: (offset: number | undefined) => TabBarDraw;
}

function trimmedLabel(model: TabBarModel, item: TabLayoutItem, rtl: boolean): TextLayoutResult {
  const { layout } = model.computed[item.index]!;
  if (!item.truncated || !model.fontMetrics) return layout;
  return trimSoloLine(layout, TEXT_LINE_DEFAULT_OVERRUN, item.textBudgetPx, {
    fontMetrics: model.fontMetrics,
    fontSizePx: model.fontSizePx,
    isDrawnRtl: rtl,
  });
}

function drawnTab(model: TabBarModel, item: TabLayoutItem, size: Vector2, rtl: boolean): DrawnTab {
  const tab = model.computed[item.index]!;
  const label = trimmedLabel(model, item, rtl);
  return {
    index: item.index,
    tab,
    x: tabDrawX(item.ofs, item.width, size.x, rtl),
    width: item.width,
    label,
    content: layoutTabContent({
      barHeightPx: size.y,
      style: tab.style,
      tabWidthPx: item.width,
      rtl,
      iconSize: tab.iconSize,
      hasText: tab.tab.title.length > 0,
      textNaturalHeightPx: label.heightPx,
      textAdvanceWidthPx: item.textBudgetPx,
      hSeparation: model.hSeparation,
      closeVisible: tab.closeVisible,
      closeIconSize: model.closeIconSize,
      buttonHlMargin: model.closeButtonMargin,
    }),
  };
}

function drawOrder(items: readonly TabLayoutItem[], currentTab: number): TabLayoutItem[] {
  const current = items.filter((item) => item.index === currentTab);
  return [...items.filter((item) => item.index !== currentTab), ...current];
}

function scrollArrows(model: TabBarModel, placed: TabBarDrawLayout, size: Vector2, rtl: boolean) {
  if (!placed.buttonsVisible) return null;
  return layoutScrollArrows({
    barWidthPx: size.x,
    barHeightPx: size.y,
    incrementIconSize: model.incrementIconSize,
    decrementIconSize: model.decrementIconSize,
    missingRight: placed.missingRight,
    canScrollBack: placed.offset > 0,
    rtl,
  });
}

function drawAt(model: TabBarModel, size: Vector2, rtl: boolean, offset: number | undefined): TabBarDraw {
  const placed = computeTabBarDrawLayout(model.drawInputs, {
    ...model.layoutInput,
    barWidthPx: size.x,
    offset,
  });
  return {
    tabs: drawOrder(placed.items, model.layoutInput.currentTab).map((item) =>
      drawnTab(model, item, size, rtl)
    ),
    arrows: scrollArrows(model, placed, size, rtl),
  };
}

export const tabBarLayout = defineRectShare((n, size, theme): TabBarLayout => {
  const model = tabBarModel(n, theme);
  // One draw for each first drawn tab: a TabContainer's strip asks for the offset its load reached.
  const byOffset = new Map<number | undefined, TabBarDraw>();
  return {
    model,
    at: (offset) => {
      let draw = byOffset.get(offset);
      if (!draw) {
        draw = drawAt(model, size, n.rtl, offset);
        byOffset.set(offset, draw);
      }
      return draw;
    },
  };
});
