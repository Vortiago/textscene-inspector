/** TabBar properties, from `scene/gui/tab_bar.h`. */

import type { ControlProperties } from '../control/types';

/**
 * One `tab_<idx>/<leaf>` element: the four leaves TabBar serialises (`tab_bar.cpp:2190-2193`).
 * `hidden` (`tab_bar.h:84`) is not one of them, so `parseTabBar` never sets it. It stays for
 * TabContainer's own `tab_<idx>/hidden` family (`tab_container.cpp:1275`), which reaches this
 * array when `nativeSolver.ts` lays out TabContainer's internal strip.
 */
export interface TabBarTabProperties {
  title: string;
  tooltip: string;
  icon?: string;
  disabled: boolean;
  hidden?: boolean;
}

export interface TabBarProperties extends ControlProperties {
  /** Dense, one slot per index 0..tab_count-1, built from `tab_<idx>/*`. */
  tabs?: TabBarTabProperties[];
  /** `tab_bar.h:113`, default -1 (no tab selected). */
  currentTab?: number;
  /** `TabBar::AlignmentMode` (`tab_bar.h:43-47`): 0 LEFT, 1 CENTER, 2 RIGHT. Default 0. */
  tabAlignment?: number;
  /** `TabBar::CloseButtonDisplayPolicy` (`tab_bar.h:50-54`): 0 NEVER, 1 ACTIVE_ONLY, 2 ALWAYS. Default 0. */
  tabCloseDisplayPolicy?: number;
  /** `tab_bar.h:129`, default 0 (unbounded). */
  maxTabWidth?: number;
  /** `tab_bar.h:133`, default -1. */
  tabsRearrangeGroup?: number;
  /** `tab_bar.h:114`, default true. */
  clipTabs?: boolean;
  /** `tab_bar.h:125`, default true. Interaction only. */
  closeWithMiddleMouse?: boolean;
  /** `tab_bar.h:130`, default true. Interaction only. */
  scrollingEnabled?: boolean;
  /** `tab_bar.h:131`, default false. Interaction only. */
  dragToRearrangeEnabled?: boolean;
  /** `tab_bar.h:134`, default true. Interaction only. */
  switchOnDragHover?: boolean;
  /** `tab_bar.h:132`, default true. Interaction only. */
  scrollToSelected?: boolean;
  /** `tab_bar.h:120`, default false. Interaction only. */
  selectWithRmb?: boolean;
  /** `tab_bar.h:121`, default false. Interaction only. */
  deselectEnabled?: boolean;
}
