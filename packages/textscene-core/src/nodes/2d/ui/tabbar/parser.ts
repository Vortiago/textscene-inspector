/** TabBar parser — Control + scalar tab-bar properties + the `tab_<idx>/*` family. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { boolSlotValue, indexedElements, ruleCount } from '../../../../godot/index.js';
import { parseControl } from '../control/parser';
import { MAX_WALKED_ELEMENTS } from '../shared/countWalk';
import type { TabBarProperties, TabBarTabProperties } from './types';

export function parseTabBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): TabBarProperties {
  const result: TabBarProperties = { ...parseControl(heading, properties) };

  result.currentTab = parseOptionalInt(properties.current_tab);
  result.tabAlignment = parseOptionalInt(properties.tab_alignment);
  result.tabCloseDisplayPolicy = parseOptionalInt(properties.tab_close_display_policy);
  result.maxTabWidth = parseOptionalInt(properties.max_tab_width);
  result.tabsRearrangeGroup = parseOptionalInt(properties.tabs_rearrange_group);
  result.clipTabs = boolSlotValue(properties.clip_tabs);
  result.closeWithMiddleMouse = boolSlotValue(properties.close_with_middle_mouse);
  result.scrollingEnabled = boolSlotValue(properties.scrolling_enabled);
  result.dragToRearrangeEnabled = boolSlotValue(properties.drag_to_rearrange_enabled);
  result.switchOnDragHover = boolSlotValue(properties.switch_on_drag_hover);
  result.scrollToSelected = boolSlotValue(properties.scroll_to_selected);
  result.selectWithRmb = boolSlotValue(properties.select_with_rmb);
  result.deselectEnabled = boolSlotValue(properties.deselect_enabled);

  // Dense one slot per index, same shape as OptionButton's `item_N/*` walk:
  // `current_tab` can point past the last NAMED index, and alignment with it
  // matters more than trimming a tail nothing reads.
  const tabCount = ruleCount(properties.tab_count) ?? 0;
  const declared = indexedElements(properties, 'tab_', 'is_valid_int');
  let observed = -1;
  for (const index of declared.keys()) if (index > observed) observed = index;
  if (result.currentTab !== undefined && result.currentTab > observed) observed = result.currentTab;
  const slots = Math.min(tabCount, observed + 1, MAX_WALKED_ELEMENTS);

  const tabs: TabBarTabProperties[] = [];
  for (let i = 0; i < slots; i++) {
    const leaves = declared.get(i);
    const rawTitle = leaves?.get('title');
    const rawTooltip = leaves?.get('tooltip');
    const icon = leaves?.get('icon');
    tabs.push({
      title: rawTitle !== undefined ? unquoteString(rawTitle) : '',
      tooltip: rawTooltip !== undefined ? unquoteString(rawTooltip) : '',
      ...(icon !== undefined ? { icon } : {}),
      disabled: boolSlotValue(leaves?.get('disabled')) === true,
    });
  }
  if (tabs.length > 0) result.tabs = tabs;

  return result;
}
