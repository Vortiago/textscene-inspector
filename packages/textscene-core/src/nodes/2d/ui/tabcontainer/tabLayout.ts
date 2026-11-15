/**
 * The geometry of a TabContainer: its pages, the header band, the page band and the rect of its
 * internal TabBar (`tab_container.cpp`), shared by its solver, its internal TabBar and its painter.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { isTopLevelItem } from '../../../../r3f/canvasPaintOrder';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { isPromotedControl, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../godot/math/rect2';
import { TAB_ALIGNMENT_LEFT, TAB_ALIGNMENT_RIGHT } from '../tabbar/nativeSolver';
import type { TabBarTabProperties } from '../tabbar/types';
import type { TabContainerTabOverride } from './types';

/** `TabContainer::TabPosition` (`tab_container.h`): 0 TOP, 1 BOTTOM. */
export const TABS_POSITION_TOP = 0;
export const TABS_POSITION_BOTTOM = 1;

/**
 * Every direct child is a tab page: `TabContainer::_get_tab_controls` (`:469-481`) uses
 * `SortableVisibilityMode::IGNORE`, so a page with `visible = false` is still a page, which the
 * walker hides. The cast still drops a Control promoted past a Node2D and a `top_level` one
 * (`container.cpp:144-146`, ahead of every visibility mode).
 */
export function deriveTabContainerTabs(
  n: Pick<SolveNode, 'children'>,
  overrides: Readonly<Record<number, TabContainerTabOverride>> | undefined
): TabBarTabProperties[] {
  return n.children
    .filter((child) => !isPromotedControl(child) && !isTopLevelItem(child.node))
    .map((child, i) => {
      const override = overrides?.[i];
      return {
        // `add_child_notify` names the tab after the child (`:653`), and `set_tab_title` overrides it (`:883-907`).
        title: override?.title ?? child.node.name,
        tooltip: '',
        icon: override?.icon,
        disabled: override?.disabled ?? false,
        hidden: override?.hidden ?? false,
      };
    });
}

export interface StyleMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** `theme_cache.tabbar_style->get_margin(...)`, the table's `TabContainer/tabbar_background`. */
export function tabbarStyleMargins(styleBoxes: SolveNode['styleBoxes']): StyleMargins {
  return requiredThemeItem(styleBoxes, 'tabbar_background').contentMargin;
}

/**
 * `TabContainer::_get_tab_height` (`:51-58`): the strip's minimum height plus the top and bottom
 * margins of the tabbar style. The caller answers 0 where the header is hidden or there are no tabs.
 */
export function tabHeaderHeight(barMinHeightPx: number, tabbarMargin: StyleMargins): number {
  return barMinHeightPx + tabbarMargin.top + tabbarMargin.bottom;
}

/**
 * The rect of the internal TabBar: `_update_margins` (`:405-460`) and the vertical anchors of `_repaint`
 * (`:362-373`). Under RTL the margins swap (`:412`) and the bar mirrors (`control.cpp:1785-1787`), so
 * `side_margin` moves to the other edge. `sideMargin` is 0 once RIGHT alignment reclaims it (`:450`).
 */
export function tabBarRect(
  containerRect: Rect2,
  barMinHeightPx: number,
  tabsPosition: number,
  alignment: number,
  sideMargin: number,
  tabbarMargin: StyleMargins,
  rtl: boolean
): Rect2 {
  const leftMargin = rtl ? tabbarMargin.right : tabbarMargin.left;
  const rightMargin = rtl ? tabbarMargin.left : tabbarMargin.right;

  let offsetLeft = leftMargin;
  let offsetRight = -rightMargin;
  if (alignment === TAB_ALIGNMENT_LEFT) {
    offsetLeft = leftMargin + sideMargin;
  } else if (alignment === TAB_ALIGNMENT_RIGHT) {
    offsetRight = -rightMargin - sideMargin;
  }

  const w = containerRect.w + offsetRight - offsetLeft;
  const x = rtl ? containerRect.w - offsetLeft - w : offsetLeft;
  const headerHeight = tabHeaderHeight(barMinHeightPx, tabbarMargin);
  const y = (tabsPosition === TABS_POSITION_BOTTOM ? containerRect.h - headerHeight : 0) + tabbarMargin.top;
  return { x, y, w, h: barMinHeightPx };
}

/**
 * `TabContainer::_notification(DRAW)` (`:257-262`): `tabbar_style` draws across the whole width of the
 * container, not over the inset rect of the bar.
 */
export function tabHeaderBand(containerRect: Rect2, headerHeight: number, tabsPosition: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_BOTTOM ? containerRect.h - headerHeight : 0;
  return { x: 0, y, w: containerRect.w, h: headerHeight };
}

/**
 * `TabContainer::_repaint` (`:359-403`): the content band before the inset of `panel_style`, for every
 * page (`:377-399`). It sets `PRESET_FULL_RECT` and pixel offsets, never `fit_child_in_rect`, so only
 * the floor of `Control::set_rect` (`dispatchChildren` in `controlRectSolver.ts`) applies.
 */
export function tabContentBand(containerRect: Rect2, headerHeight: number, tabsPosition: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_TOP ? headerHeight : 0;
  return { x: 0, y, w: containerRect.w, h: containerRect.h - headerHeight };
}
