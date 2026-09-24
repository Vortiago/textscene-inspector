/** Parses a TabContainer: Control, the scalar properties and the sparse `tab_<idx>/*` override family. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { boolSlotValue, indexedElements } from '../../../../godot/index.js';
import { parseControl } from '../control/parser';
import type { TabContainerProperties, TabContainerTabOverride } from './types';

export function parseTabContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): TabContainerProperties {
  const result: TabContainerProperties = { ...parseControl(heading, properties) };

  result.currentTab = parseOptionalInt(properties.current_tab);
  result.tabAlignment = parseOptionalInt(properties.tab_alignment);
  result.tabsPosition = parseOptionalInt(properties.tabs_position);
  result.clipTabs = boolSlotValue(properties.clip_tabs);
  result.tabsVisible = boolSlotValue(properties.tabs_visible);
  result.allTabsInFront = boolSlotValue(properties.all_tabs_in_front);
  result.switchOnDragHover = boolSlotValue(properties.switch_on_drag_hover);
  result.dragToRearrangeEnabled = boolSlotValue(properties.drag_to_rearrange_enabled);
  result.tabsRearrangeGroup = parseOptionalInt(properties.tabs_rearrange_group);
  result.useHiddenTabsForMinSize = boolSlotValue(properties.use_hidden_tabs_for_min_size);
  result.tabFocusMode = parseOptionalInt(properties.tab_focus_mode);
  result.deselectEnabled = boolSlotValue(properties.deselect_enabled);

  // Sparse, keyed by the raw index: `types.ts` says why no `tab_count` sizes this family.
  const declared = indexedElements(properties, 'tab_', 'is_valid_int');
  if (declared.size > 0) {
    const overrides: Record<number, TabContainerTabOverride> = {};
    for (const [index, leaves] of declared) {
      const entry: TabContainerTabOverride = {};
      const rawTitle = leaves.get('title');
      if (rawTitle !== undefined) entry.title = unquoteString(rawTitle);
      const icon = leaves.get('icon');
      if (icon !== undefined) entry.icon = icon;
      const disabled = boolSlotValue(leaves.get('disabled'));
      if (disabled !== undefined) entry.disabled = disabled;
      const hidden = boolSlotValue(leaves.get('hidden'));
      if (hidden !== undefined) entry.hidden = hidden;
      overrides[index] = entry;
    }
    result.tabOverrides = overrides;
  }

  return result;
}
