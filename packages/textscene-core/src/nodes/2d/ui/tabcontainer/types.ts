/** TabContainer properties, from `scene/gui/tab_container.h`. */

import type { ControlProperties } from '../control/types';

/**
 * One `tab_<idx>/<leaf>` element: the four leaves TabContainer serialises
 * (`tab_container.cpp:1272-1275`), with `hidden` and no `tooltip`. Sparse by index: the
 * length getter is the child count, unknown at parse, and `enable_out_of_bounds_assign()`
 * (`:1294`) accepts any non-negative index.
 */
export interface TabContainerTabOverride {
  title?: string;
  icon?: string;
  disabled?: boolean;
  hidden?: boolean;
}

export interface TabContainerProperties extends ControlProperties {
  /** `tab_<idx>/*` overrides, keyed by the raw index. `nativeSolver.ts` pairs each with its child at render time. */
  tabOverrides?: Readonly<Record<number, TabContainerTabOverride>>;
  /**
   * `tab_container.h`, default -1 (no tab selected), but a loaded scene with pages never
   * keeps that. Read the selection through `nativeSolver.ts`'s `tabContainerCurrentTab`.
   */
  currentTab?: number;
  /** `TabBar::AlignmentMode` (`tab_bar.h:43-47`): 0 LEFT, 1 CENTER, 2 RIGHT. Default 0. */
  tabAlignment?: number;
  /** `TabContainer::TabPosition` (`tab_container.h`): 0 TOP, 1 BOTTOM. Default 0. */
  tabsPosition?: number;
  /** Default true. */
  clipTabs?: boolean;
  /** Default true. */
  tabsVisible?: boolean;
  /** Default false. */
  allTabsInFront?: boolean;
  /** Default true. */
  switchOnDragHover?: boolean;
  /** Default false. Interaction only. */
  dragToRearrangeEnabled?: boolean;
  /** Default -1. Interaction only. */
  tabsRearrangeGroup?: number;
  /** Default false. */
  useHiddenTabsForMinSize?: boolean;
  /** `Control::FocusMode` restricted to the hint's 3 labels (`tab_container.cpp:1218`): 0 None, 1 Click, 2 All. Default 2 (All). Interaction only. */
  tabFocusMode?: number;
  /** `TabBar::deselect_enabled` (`tab_bar.h:121`), default false: one of the two conditions under which `current_tab = -1` survives the load (`tabContainerCurrentTab`). */
  deselectEnabled?: boolean;
}
