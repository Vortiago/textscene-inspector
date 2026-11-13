/**
 * Which tab a TabBar opens on, from the file alone. The TabBar and the TabContainer both read it,
 * and so does the visible a TabContainer writes onto its pages, which every walk needs.
 */

import type { TabBarTabProperties } from './types';

/**
 * `TabBar::current` once tabs load: `set_tab_count` moves the `-1` default to 0 unless the bar can
 * deselect, and `set_current_tab` refuses an index past the last tab (`tab_bar.cpp:763-767,795-805`).
 * `_can_deselect` is `deselect_enabled`, or every tab disabled or hidden (`:1324-1331,1862-1873`).
 */
export function resolveTabBarCurrentTab(
  authored: number | undefined,
  deselectEnabled: boolean | undefined,
  tabCount: number,
  isUnselectable: (index: number) => boolean
): number {
  if (tabCount === 0) return -1;
  if (authored !== undefined && authored >= 0 && authored < tabCount) return authored;
  if (deselectEnabled === true) return -1;
  for (let i = 0; i < tabCount; i++) {
    if (!isUnselectable(i)) return 0;
  }
  return -1;
}

/** Whether a tab can never be the current one: disabled or hidden (`tab_bar.cpp:1862-1873`). */
export function isTabUnselectable(tab: Pick<TabBarTabProperties, 'disabled' | 'hidden'>): boolean {
  return tab.disabled || tab.hidden === true;
}
