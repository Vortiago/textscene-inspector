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
  /** The first drawn tab: `TabBar::offset`. */
  offset: number;
  /** The `side_margin` the bar leaves free: 0 once RIGHT alignment reclaims it. */
  sideMarginPx: number;
}

/**
 * Replays the load order of `tab_container.cpp` and `tab_bar.cpp`: each page adds a tab and runs
 * `_update_margins` (`:640-656`), the bar enters the tree, then `NOTIFICATION_READY` hides pages (`:228-237`).
 * The first frame sizes the bar. `scroll_to_selected` is the TabBar default, as TabContainer has no property.
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
    if (!input.scrollToSelected) return;
    offset = ensureTabVisible(shown(), sizes, place(), offset, layoutInput());
  };

  /** `TabContainer::_update_margins` (`tab_container.cpp:405-460`) and the bar's `NOTIFICATION_RESIZED`. */
  const updateMargins = () => {
    if (tabCount === 0) return;
    if (!hasBarEnteredTree) {
      barWidthPx = marginedBarWidth();
      return;
    }
    // The bar compares against the cache of its old width (`tab_bar.cpp:511-519`), so read it before the resize.
    const maxDrawnBefore = place().maxDrawnTab;
    barWidthPx = marginedBarWidth();
    const offsetBefore = offset;
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
  // ENTER_TREE runs one `ensure_tab_visible`, with no page hidden (`tab_bar.cpp:401`).
  hasBarEnteredTree = true;
  scrollToCurrent();
  // A hidden tab reruns the cache, the over-offset pull and the scroll (`tab_bar.cpp:1078-1091`), then the margins (`:994-997`).
  tabs.forEach((tab, index) => {
    if (!tab.hidden) return;
    hiddenIndices.add(index);
    pullBack();
    scrollToCurrent();
    updateMargins();
  });
  // RIGHT alignment: the bar is the full container wide until the first frame, so every earlier
  // decision reclaimed `side_margin`.
  if (input.alignment === TAB_ALIGNMENT_RIGHT) {
    barWidthPx = fullWidthPx;
    pullBack();
  }
  updateMargins();

  return {
    offset,
    sideMarginPx: input.alignment === TAB_ALIGNMENT_RIGHT && barWidthPx === fullWidthPx ? 0 : sideMarginPx,
  };
}
