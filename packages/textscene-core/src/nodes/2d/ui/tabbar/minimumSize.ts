/**
 * `TabBar::get_minimum_size` (`tab_bar.cpp:44-122`) from the TabBar shares.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Vector2 } from '../../../../godot/math/vector';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { tabBarFacts, tabBarModel, tabWidths, type TabBarFacts, type TabBarModel } from './tabBarModel';

/** What one tab gives the minimum size. */
interface TabMinimum {
  isHidden: boolean;
  width: number;
  iconHeight: number | null;
  closeVisible: boolean;
  textHeightPx: number;
}

/**
 * Each tab, with its title shaped when `model` is given. Without one a title adds its height 0 and
 * its width 0, and its separation stays.
 */
function tabMinimums(bar: TabBarFacts, model: TabBarModel | null): TabMinimum[] {
  return bar.tabs.map((facts, i) => {
    const shaped = model?.computed[i];
    return {
      isHidden: facts.tab.hidden === true,
      width: shaped ? shaped.minimumWidth : tabWidths(bar, facts, 0).minimumWidth,
      iconHeight: facts.iconSize?.y ?? null,
      closeVisible: facts.closeVisible,
      textHeightPx: shaped ? shaped.layout.heightPx : 0,
    };
  });
}

/**
 * A hidden tab contributes nothing (only TabContainer's strip sets `Tab::hidden` in tab_bar.h).
 * `text_buf->get_size().y` (`:82`) folds into the height for every shown tab, since an empty title
 * still shapes one line. `clip_tabs` replaces the summed width with the widest tab plus the scroll
 * arrows (`:117-119`).
 */
function sizeOf(bar: TabBarFacts, tabs: readonly TabMinimum[]): Vector2 {
  if (tabs.length === 0) return { x: 0, y: 0 };
  let width = 0;
  let height = 0;
  let widestTab = 0;
  tabs.forEach((tab, i) => {
    if (tab.isHidden) return;
    if (tab.iconHeight !== null) height = Math.max(height, tab.iconHeight + bar.yMargin);
    height = Math.max(height, tab.textHeightPx + bar.yMargin);
    if (tab.closeVisible) height = Math.max(height, bar.closeIconSize.y + bar.yMargin);
    width += tab.width;
    if (i < tabs.length - 1) width += bar.layoutInput.tabSeparation;
    widestTab = Math.max(widestTab, tab.width);
  });
  if (!bar.layoutInput.clipTabs) return { x: width, y: height };
  const arrowsWidth = tabs.length > 1 ? bar.incrementIconSize.x + bar.decrementIconSize.x : 0;
  return { x: widestTab + arrowsWidth, y: height };
}

/** Only `_update_cache` reads `max_tab_width`, so the minimum ignores it. */
export const tabBarMinimumSize: MinimumSizeFn = (n, ctx) => {
  const bar = tabBarFacts(n, ctx.theme);
  return sizeOf(bar, tabMinimums(bar, ctx.measureText ? tabBarModel(n, ctx.theme) : null));
};
