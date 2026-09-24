/**
 * TabBar strict validators. Declare only the members doc/classes/TabBar.xml
 * lists without `overrides=`: the base-walk delivers the inherited ones, and a
 * re-declared key shadows its ancestor.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * The `tab_<idx>/<leaf>` leaves: only the four `register_property` calls at
 * tab_bar.cpp:2190-2193. The other per-tab setters (metadata, hidden, language,
 * text_direction, button_icon, icon_max_width, tab_bar.cpp:2064-2079) resolve to no
 * helper `Property` (property_list_helper.cpp:63) and drop, so they are unknown keys.
 */
const TAB_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // tab_bar.cpp:2190, Variant::STRING, no hint. `set_tab_title` (tab_bar.cpp:900)
  // checks the tab index, never the text.
  title: v.quotedString('title'),
  // tab_bar.cpp:2191, Variant::STRING, no hint. `set_tab_tooltip`
  // (tab_bar.cpp:925) is the same shape.
  tooltip: v.quotedString('tooltip'),
  // tab_bar.cpp:2192, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  icon: v.resourceReference('icon'),
  // tab_bar.cpp:2193, Variant::BOOL, no hint.
  disabled: v.boolean('disabled'),
};

/**
 * The bare `tab_` prefix (tab_bar.cpp:2188) collides with `tab_alignment`,
 * `tab_count` and `tab_close_display_policy`. The dispatcher and the registry
 * require an integer before a `/`, and the registry tries exact keys first, so
 * the three scalars keep their own validators.
 */
const tabValidator = indexedFamilyValidator({
  prefix: 'tab_',
  leaves: TAB_LEAVES,
  unknownCode: 'INVALID_TAB_KEY',
  describes: 'tab',
  // `_set` is `property_helper.property_set_value` (tab_bar.h:208), which drops an
  // index that fails `is_valid_int()` (property_list_helper.cpp:53-55).
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_TAB_INDEX',
    message: (index) =>
      `Tab index ${index} must be non-negative. TabBar routes every tab_<idx>/<leaf> write through PropertyListHelper::_get_property, which returns nullptr for a negative index (property_list_helper.cpp:58), so TabBar::_set reports the key as unhandled and the value is silently dropped`,
  },
});

validatorRegistry.registerAll('TabBar', {
  // tab_bar.cpp:2123, PROPERTY_HINT_RANGE "-1,4096,1". Below -1, `ERR_FAIL_INDEX`
  // (tab_bar.cpp:804) refuses the write. -1 meets `_can_deselect()` (tab_bar.cpp:798), a
  // sibling-tab check no validator sees, which passes while the tab vector is empty at
  // load. 4096 is only in the hint, so it warns.
  current_tab: v.int('current_tab', {
    min: -1,
    max: 4096,
    enforced: { min: 'tab_bar.cpp:804' },
    hinted: { max: 'tab_bar.cpp:2123' },
  }),
  // tab_bar.cpp:2124, PROPERTY_HINT_ENUM "Left,Center,Right". `ERR_FAIL_INDEX(p_alignment,
  // ALIGNMENT_MAX)` (tab_bar.cpp:1671) refuses both ends. ALIGNMENT_MAX is 3 (tab_bar.h:47).
  tab_alignment: v.enumInt(
    'tab_alignment',
    0,
    2,
    { 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT' },
    { enforced: 'tab_bar.cpp:1671' }
  ),
  // tab_bar.cpp:2127, PROPERTY_HINT_ENUM "Show Never,Show Active Only,Show Always".
  // `ERR_FAIL_INDEX(p_policy, CLOSE_BUTTON_MAX)` (tab_bar.cpp:1944), CLOSE_BUTTON_MAX is 3 (tab_bar.h:54).
  tab_close_display_policy: v.enumInt(
    'tab_close_display_policy',
    0,
    2,
    { 0: 'SHOW_NEVER', 1: 'SHOW_ACTIVE_ONLY', 2: 'SHOW_ALWAYS' },
    { enforced: 'tab_bar.cpp:1944' }
  ),
  // tab_bar.cpp:2128, PROPERTY_HINT_RANGE "0,99999,1,suffix:px". `set_max_tab_width`
  // refuses only `p_width < 0` (tab_bar.cpp:1966), so the ceiling is the hint's warning.
  max_tab_width: v.int('max_tab_width', {
    min: 0,
    max: 99999,
    enforced: { min: 'tab_bar.cpp:1966' },
    hinted: { max: 'tab_bar.cpp:2128' },
  }),
  // tab_bar.cpp:2132, Variant::INT, no hint. `set_tabs_rearrange_group` (tab_bar.cpp:2004)
  // assigns anything, and -1 is the "no group" default, so no bound applies.
  tabs_rearrange_group: v.int('tabs_rearrange_group'),

  // The eight Variant::BOOL properties, tab_bar.cpp:2125, 2126, 2129, 2130,
  // 2131, 2133, 2134, 2135. Every setter is a plain assignment.
  clip_tabs: v.boolean('clip_tabs'),
  close_with_middle_mouse: v.boolean('close_with_middle_mouse'),
  scrolling_enabled: v.boolean('scrolling_enabled'),
  drag_to_rearrange_enabled: v.boolean('drag_to_rearrange_enabled'),
  switch_on_drag_hover: v.boolean('switch_on_drag_hover'),
  scroll_to_selected: v.boolean('scroll_to_selected'),
  select_with_rmb: v.boolean('select_with_rmb'),
  deselect_enabled: v.boolean('deselect_enabled'),

  // tab_bar.cpp:2137 `ADD_ARRAY_COUNT`: an INT ADD_PROPERTY with PROPERTY_HINT_NONE
  // (class_db.cpp:1492). `set_tab_count` refuses `p_count < 0` (tab_bar.cpp:745),
  // and nothing bounds the ceiling.
  tab_count: v.int('tab_count', { min: 0, enforced: 'tab_bar.cpp:745' }),

  'tab_#/*': tabValidator,
});
