/**
 * TabContainer strict validators for linting.
 *
 * Declare only TabContainer's OWN members: the ones doc/classes/TabContainer.xml
 * lists without an `overrides=` attribute. Everything from Container up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Container itself has no own members (no linterParser.ts in ../container), so
 * this imports Control's directly, matching the scaffold.
 *
 * `tab_<i>/*` is TabContainer's OWN `PropertyListHelper` family
 * (tab_container.cpp:1270-1276) — a SEPARATE `PropertyListHelper` instance
 * from TabBar's already-validated one (tabbar/linterParser.ts), with its own
 * leaf set (title/icon/disabled/hidden, no tooltip). See
 * propertyListRouteCoverage.test.ts.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * `tab_<idx>/<leaf>` leaves, exactly the four
 * `base_property_helper.register_property` calls at tab_container.cpp:1272-1275.
 */
const TAB_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // tab_container.cpp:1272, Variant::STRING, no hint. set_tab_title
  // (tab_container.cpp:883) assigns any string past an ERR_FAIL on the tab
  // CONTROL, never on the text.
  title: v.quotedString('title'),
  // tab_container.cpp:1273, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  icon: v.resourceReference('icon'),
  // tab_container.cpp:1274, Variant::BOOL, no hint.
  disabled: v.boolean('disabled'),
  // tab_container.cpp:1275, Variant::BOOL, no hint.
  hidden: v.boolean('hidden'),
};

const tabValidator = indexedFamilyValidator({
  prefix: 'tab_',
  leaves: TAB_LEAVES,
  unknownCode: 'INVALID_TABCONTAINER_TAB_KEY',
  describes: 'tab',
  // `_set` is `property_helper.property_set_value` verbatim, whose
  // `_get_property` returns nullptr unless the index `is_valid_int()`
  // (property_list_helper.cpp:53-55), the same shape TabBar's own tab_<i>/*
  // family uses.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_TABCONTAINER_TAB_INDEX',
    message: (index) =>
      `Tab index ${index} must be non-negative. TabContainer routes every tab_<idx>/<leaf> write through PropertyListHelper::_get_property, which returns nullptr for a negative index (property_list_helper.cpp:58), so TabContainer's own _set reports the key as unhandled and the value is silently dropped`,
  },
});

validatorRegistry.registerAll('TabContainer', {
  // tab_container.cpp:1208, ADD_PROPERTY(..., "tab_alignment", PROPERTY_HINT_ENUM,
  // "Left,Center,Right"). Delegates to TabBar::set_tab_alignment, which has
  // `ERR_FAIL_INDEX(p_alignment, ALIGNMENT_MAX)` (tab_bar.cpp:1671,
  // ALIGNMENT_MAX=3): the enforced ceiling agrees with the hint's 3 labels.
  tab_alignment: v.enumInt(
    'tab_alignment',
    0,
    2,
    { 0: 'Left', 1: 'Center', 2: 'Right' },
    { enforced: 'tab_bar.cpp:1671' }
  ),

  // tab_container.cpp:1209, PROPERTY_HINT_RANGE "-1,4096,1". set_current_tab
  // defers to setup_current_tab while outside the tree (tab_container.cpp:744),
  // resolved on ENTER_TREE (tab_container.cpp:222-224) through
  // TabBar::set_current_tab. Any value below -1 unconditionally hits
  // `ERR_FAIL_INDEX(p_current, get_tab_count())` (tab_bar.cpp:804), since a
  // negative index fails that check regardless of tab count; -1 itself is a
  // sentinel handled separately (tab_bar.cpp:798) meaning "no tab selected".
  // CEILING: 4096 exists only in the hint, which carries no or_greater, so it
  // is a warning — the same split TabBar's own current_tab makes.
  current_tab: v.int('current_tab', {
    min: -1,
    max: 4096,
    enforced: { min: 'tab_bar.cpp:804' },
    hinted: { max: 'tab_container.cpp:1209' },
  }),

  // tab_container.cpp:1210, PROPERTY_HINT_ENUM "Top,Bottom". TabContainer's OWN
  // set_tabs_position has `ERR_FAIL_INDEX(p_tabs_position, POSITION_MAX)`
  // (tab_container.cpp:820, POSITION_MAX=2): enforced, agrees with the hint.
  tabs_position: v.enumInt(
    'tabs_position',
    0,
    1,
    { 0: 'Top', 1: 'Bottom' },
    { enforced: 'tab_container.cpp:820' }
  ),

  // tab_container.cpp:1211, plain BOOL, no hint. set_clip_tabs bare-assigns.
  clip_tabs: v.boolean('clip_tabs'),

  // tab_container.cpp:1212, plain BOOL, no hint. set_tabs_visible bare-assigns.
  tabs_visible: v.boolean('tabs_visible'),

  // tab_container.cpp:1213, plain BOOL, no hint. set_all_tabs_in_front bare-assigns.
  all_tabs_in_front: v.boolean('all_tabs_in_front'),

  // tab_container.cpp:1214, plain BOOL, no hint. set_switch_on_drag_hover
  // delegates to TabBar's own, which bare-assigns (tab_bar.cpp:2022).
  switch_on_drag_hover: v.boolean('switch_on_drag_hover'),

  // tab_container.cpp:1215, plain BOOL, no hint. set_drag_to_rearrange_enabled
  // delegates to TabBar's own, which bare-assigns (tab_bar.cpp:1995).
  drag_to_rearrange_enabled: v.boolean('drag_to_rearrange_enabled'),

  // tab_container.cpp:1216, plain INT, no hint (PROPERTY_HINT_NONE).
  // set_tabs_rearrange_group delegates to TabBar's own (tab_bar.cpp:2003),
  // which bare-assigns with no ERR_FAIL and no clamp. Any integer is legal,
  // including the -1 sentinel that disables cross-container rearranging.
  tabs_rearrange_group: v.int('tabs_rearrange_group'),

  // tab_container.cpp:1217, plain BOOL, no hint.
  // set_use_hidden_tabs_for_min_size bare-assigns.
  use_hidden_tabs_for_min_size: v.boolean('use_hidden_tabs_for_min_size'),

  // tab_container.cpp:1218, PROPERTY_HINT_ENUM "None,Click,All" (3 labels,
  // 0-2). set_tab_focus_mode delegates to the internal TabBar's
  // Control::set_focus_mode, whose own `ERR_FAIL_INDEX((int)p_focus_mode, 4)`
  // (control.cpp:2267) accepts a 4th value (Accessibility, 3) that
  // TabContainer's own hint never lists. That gap is exactly what a hint
  // constrains in the widget without the engine refusing it, so 3 is a
  // warning grounded in this ADD_PROPERTY line, not an error.
  tab_focus_mode: v.enumInt(
    'tab_focus_mode',
    0,
    2,
    { 0: 'None', 1: 'Click', 2: 'All' },
    { hinted: 'tab_container.cpp:1218' }
  ),

  // tab_container.cpp:1219, plain BOOL, no hint. set_deselect_enabled
  // delegates to TabBar's own, which bare-assigns (tab_bar.cpp:2038).
  deselect_enabled: v.boolean('deselect_enabled'),

  // tab_container.cpp:1270-1276: see tabValidator.
  'tab_#/*': tabValidator,
});
