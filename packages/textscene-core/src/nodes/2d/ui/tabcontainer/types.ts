/** TabContainer property definitions — `scene/gui/tab_container.h`. */

import type { ControlProperties } from '../control/types';

/**
 * One `tab_<idx>/<leaf>` element — the four `base_property_helper.
 * register_property` leaves TabContainer itself serialises
 * (`tab_container.cpp:1272-1275`). A SEPARATE `PropertyListHelper` family
 * from TabBar's own (`../tabbar/types.ts`'s `TabBarTabProperties`) — this one
 * has `hidden`, not `tooltip`.
 *
 * Sparse and keyed by index rather than a dense array: TabContainer's
 * `array_length_getter` is `get_tab_count()` — the CHILD count, unknown at
 * parse time — and `property_helper.enable_out_of_bounds_assign()`
 * (`:1294`) means a `.tscn` may author any non-negative index regardless of
 * how many children follow it. `nativeSolver.ts` pairs each override with
 * its CHILD at render time, once the live children are known.
 */
export interface TabContainerTabOverride {
  title?: string;
  icon?: string;
  disabled?: boolean;
  hidden?: boolean;
}

export interface TabContainerProperties extends ControlProperties {
  /** `tab_<idx>/*` overrides, keyed by the raw index the file names. */
  tabOverrides?: Readonly<Record<number, TabContainerTabOverride>>;
  /**
   * `tab_container.h`, default -1 (no tab selected) — but a LOADED scene with
   * pages never keeps that: see `nativeSolver.ts`'s `tabContainerCurrentTab`,
   * which is what every reader of the selection goes through.
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
  /** `TabBar::deselect_enabled` (`tab_bar.h:121`), default FALSE — one of the two conditions under which `current_tab = -1` survives the load (`tabContainerCurrentTab`). */
  deselectEnabled?: boolean;
}
