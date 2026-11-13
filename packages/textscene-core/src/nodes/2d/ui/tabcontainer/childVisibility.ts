/**
 * The page a TabContainer shows and the `visible` it writes onto each page. The parser registration
 * declares it, so every walk reads it before any renderer chunk loads.
 */

import type { ChildVisibilityFn } from '../../../../core/childVisibility';
import { isTabUnselectable, resolveTabBarCurrentTab } from '../tabbar/currentTab';
import type { TabContainerProperties } from './types';

/**
 * `TabContainer::get_current_tab()` for a loaded scene: the first `add_tab` (through
 * `add_child_notify`, `tab_container.cpp:640-655`) lands on the bar's own rule,
 * `resolveTabBarCurrentTab`. An authored `current_tab` waits in `setup_current_tab`
 * (`tab_container.cpp:743-746`) until `NOTIFICATION_ENTER_TREE` (`:222-225`).
 */
export function tabContainerCurrentTab(props: TabContainerProperties, tabCount: number): number {
  return resolveTabBarCurrentTab(props.currentTab, props.deselectEnabled, tabCount, (i) =>
    isTabUnselectable({
      disabled: props.tabOverrides?.[i]?.disabled === true,
      hidden: props.tabOverrides?.[i]?.hidden === true,
    })
  );
}

/**
 * `TabContainer::_repaint`'s visibility half: `show()` on the current page and `hide()` on
 * the rest (`tab_container.cpp:377-399`), as `NOTIFICATION_VISIBILITY_CHANGED` does (`:290-293`).
 * `add_child_notify` hides each page as it is added (`:651`), so an unauthored file shows one.
 */
export const tabContainerChildVisibility: ChildVisibilityFn = (container, _child, index, count) =>
  index === tabContainerCurrentTab(container.properties as TabContainerProperties, count);
