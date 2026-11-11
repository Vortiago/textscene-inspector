/**
 * The width and first drawn tab of a TabContainer's internal TabBar once its scene has loaded.
 * Godot has no static answer: the bar's `offset` and its `side_margin` reclaim both come from the
 * order of the load events, so this replays that order against the tab layout of `tabbar/nativeSolver.ts`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import {
  TAB_ALIGNMENT_CENTER,
  TAB_ALIGNMENT_LEFT,
  TAB_ALIGNMENT_RIGHT,
  ensureNoOverOffset,
  ensureTabVisible,
  measureTabSizes,
  placeTabs,
  tabDrawX,
  type TabBarLayoutInput,
  type TabLayoutInput,
} from '../tabbar/nativeSolver';

export interface TabContainerStripInput {
  containerWidthPx: number;
  /** `tabbar_style` margins, already swapped under RTL (`tab_container.cpp:412`). */
  leftMarginPx: number;
  rightMarginPx: number;
  sideMarginPx: number;
  rtl: boolean;
}

export interface LoadedStrip {
  barWidthPx: number;
  /** The first drawn tab: `TabBar::offset`. */
  offset: number;
  /** The `side_margin` the bar leaves free: 0 once RIGHT alignment reclaims it. */
  sideMarginPx: number;
}

/**
 * Replays the load as Godot runs it (`tab_container.cpp`, `tab_bar.cpp`):
 * 1. Each page's `add_child_notify` adds a tab and calls `_update_margins` (`:640-656`), before the bar
 *    is in the tree, so no `ensure_tab_visible` runs.
 * 2. The bar enters the tree and runs `ensure_tab_visible` once (`tab_bar.cpp:401`), with no page hidden.
 * 3. `NOTIFICATION_READY` applies each `tab_<i>/hidden` (`:228-237`). A hidden tab reruns
 *    `_update_cache`, `_ensure_no_over_offset` and `ensure_tab_visible` (`tab_bar.cpp:1078-1091`), then
 *    `_update_margins` (`tab_container.cpp:994-997`).
 * 4. The bar gets its width at the first frame, and `_update_margins` runs once more. For RIGHT
 *    alignment the width before it is the full container width: until then the bar is 0 wide, so the
 *    tabs overflow and every earlier decision reclaimed `side_margin`.
 * `scroll_to_selected` is the TabBar default, as TabContainer exposes no property for it.
 */
export function resolveTabContainerStrip(
  tabs: readonly TabLayoutInput[],
  input: Omit<TabBarLayoutInput, 'barWidthPx' | 'offset'>,
  container: TabContainerStripInput
): LoadedStrip {
  const { containerWidthPx, leftMarginPx, rightMarginPx, sideMarginPx, rtl } = container;
  const fullWidthPx = containerWidthPx - leftMarginPx - rightMarginPx;
  const widthKeepingSideMargin = fullWidthPx - sideMarginPx;
  const sizes = measureTabSizes(tabs, input.maxTabWidthPx);

  let barWidthPx = input.alignment === TAB_ALIGNMENT_LEFT ? widthKeepingSideMargin : fullWidthPx;
  let offset = 0;
  let tabCount = 0;
  let hasBarEnteredTree = false;
  const hiddenIndices = new Set<number>();

  const shown = () => tabs.slice(0, tabCount).map((tab, i) => ({ ...tab, hidden: hiddenIndices.has(i) }));
  const layoutInput = (): TabBarLayoutInput => ({ ...input, barWidthPx });
  const place = () => placeTabs(shown(), sizes, layoutInput(), offset);
  const pullBack = () => {
    offset = ensureNoOverOffset(shown(), sizes, place(), offset, layoutInput());
  };
  const scrollToCurrent = () => {
    offset = ensureTabVisible(shown(), sizes, place(), offset, layoutInput());
  };

  /** `TabContainer::_update_margins` (`tab_container.cpp:405-460`) and the bar's `NOTIFICATION_RESIZED`. */
  const updateMargins = () => {
    if (tabCount === 0) return;
    barWidthPx = marginedBarWidth();
    if (!hasBarEnteredTree) return;
    const offsetBefore = offset;
    const maxDrawnBefore = place().maxDrawnTab;
    pullBack();
    if (offset !== offsetBefore || place().maxDrawnTab !== maxDrawnBefore) scrollToCurrent();
  };

  /** The bar's width under the alignment's margin rule, RIGHT reclaiming `side_margin` on overflow (`:450`). */
  const marginedBarWidth = (): number => {
    if (input.alignment === TAB_ALIGNMENT_CENTER) return fullWidthPx;
    if (input.alignment !== TAB_ALIGNMENT_RIGHT) return widthKeepingSideMargin;
    const placement = place();
    const tabX = (index: number) => tabDrawX(placement.ofs[index]!, sizes[index]!.width, barWidthPx, rtl);
    const totalTabsWidth =
      leftMarginPx + rightMarginPx + tabX(tabCount - 1) - tabX(0) + sizes[tabCount - 1]!.width;
    const overflows =
      placement.buttonsVisible || (tabCount > 1 && totalTabsWidth + sideMarginPx > containerWidthPx);
    return input.clipTabs && overflows ? fullWidthPx : widthKeepingSideMargin;
  };

  for (tabCount = 1; tabCount <= tabs.length; tabCount++) updateMargins();
  tabCount = tabs.length;
  hasBarEnteredTree = true;
  scrollToCurrent();
  tabs.forEach((tab, index) => {
    if (!tab.hidden) return;
    hiddenIndices.add(index);
    pullBack();
    scrollToCurrent();
    updateMargins();
  });
  if (input.alignment === TAB_ALIGNMENT_RIGHT) {
    barWidthPx = fullWidthPx;
    pullBack();
  }
  updateMargins();

  return {
    barWidthPx,
    offset,
    sideMarginPx: input.alignment === TAB_ALIGNMENT_RIGHT && barWidthPx === fullWidthPx ? 0 : sideMarginPx,
  };
}
