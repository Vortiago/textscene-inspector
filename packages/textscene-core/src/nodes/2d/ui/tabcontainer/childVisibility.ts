/**
 * The page a TabContainer shows and the `visible` it writes onto each page. The parser registration
 * declares it, so every walk reads it before any renderer chunk loads.
 */

import type { ChildVisibilityFn, ChildVisibilityWriteFn } from '../../../../core/childVisibility';
import { VARIANT_TYPE as T } from '../../../../godot/variant/variantType';
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
    isPageUnselectable(props, i)
  );
}

function isPageUnselectable(props: TabContainerProperties, index: number): boolean {
  return isTabUnselectable({
    disabled: props.tabOverrides?.[index]?.disabled === true,
    hidden: props.tabOverrides?.[index]?.hidden === true,
  });
}

/**
 * `TabContainer::_repaint`'s visibility half: `show()` on the current page and `hide()` on
 * the rest (`tab_container.cpp:377-399`), as `NOTIFICATION_VISIBILITY_CHANGED` does (`:290-293`).
 * `add_child_notify` hides each page as it is added (`:651`), so an unauthored file shows one.
 */
export const tabContainerChildVisibility: ChildVisibilityFn = (container, _child, index, count) =>
  index === tabContainerCurrentTab(container.properties as TabContainerProperties, count);

/** `_on_tab_visibility_changed` (`tab_container.cpp:589-624`): a shown page becomes current. */
export const tabContainerChildVisibilityWrite: ChildVisibilityWriteFn = (
  container,
  index,
  count,
  visible
) => {
  const props = container.properties as TabContainerProperties;
  const current = tabContainerCurrentTab(props, count);
  if (visible) return current === index ? [] : [currentTabWrite(index)];
  if (current !== index) return [];
  if (props.deselectEnabled === true) return [currentTabWrite(-1)];
  // The only page cannot be deselected, so `p_child->show()` puts it back (`:605-607`).
  if (count === 1) return [];
  return [
    currentTabWrite(
      nextSelectablePage(props, current, count) ?? previousSelectablePage(props, current) ?? -1
    ),
  ];
};

const currentTabWrite = (tab: number) => ['current_tab', { type: T.INT, value: tab }] as const;

/** `TabBar::get_next_available` (`tab_bar.cpp:855-866`), null for none. */
function nextSelectablePage(props: TabContainerProperties, current: number, count: number): number | null {
  for (let page = current + 1; page < count; page++) if (!isPageUnselectable(props, page)) return page;
  return null;
}

/** `TabBar::get_previous_available` (`tab_bar.cpp:839-853`), null for none. */
function previousSelectablePage(props: TabContainerProperties, current: number): number | null {
  for (let page = current - 1; page >= 0; page--) if (!isPageUnselectable(props, page)) return page;
  return null;
}
