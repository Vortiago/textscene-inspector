/**
 * TabBar strict validators for linting.
 *
 * Declare only TabBar's OWN members: the ones doc/classes/TabBar.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * The `tab_<idx>/<leaf>` leaves, which are ONLY the four
 * `base_property_helper.register_property` calls at tab_bar.cpp:2190-2193.
 *
 * TabBar binds far more per-tab setters than it serialises: `set_tab_metadata`,
 * `set_tab_hidden`, `set_tab_language`, `set_tab_text_direction`,
 * `set_tab_button_icon` and `set_tab_icon_max_width` are all
 * `ClassDB::bind_method`s (tab_bar.cpp:2064-2079) reachable only from script.
 * A key naming one of them resolves to no `Property` in the helper's
 * `property_list` (property_list_helper.cpp:63) and is silently dropped, so
 * they are rejected as unknown rather than validated.
 */
const TAB_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // tab_bar.cpp:2190, Variant::STRING, no hint. `set_tab_title`
  // (tab_bar.cpp:900) assigns any string past an ERR_FAIL_INDEX on the tab
  // INDEX, never on the text.
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
 * The prefix is the bare `tab_` set at tab_bar.cpp:2188, which collides with
 * the scalar keys `tab_alignment`, `tab_count` and `tab_close_display_policy`.
 * Both this dispatcher and the registry's own lookup require an integer run
 * between the prefix and a `/`, and the registry consults exact keys first, so
 * the three scalars keep their own validators.
 */
const tabValidator = indexedFamilyValidator({
  prefix: 'tab_',
  leaves: TAB_LEAVES,
  unknownCode: 'INVALID_TAB_KEY',
  describes: 'tab',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_TAB_INDEX',
    message: (index) =>
      `Tab index ${index} must be non-negative. TabBar routes every tab_<idx>/<leaf> write through PropertyListHelper::_get_property, which returns nullptr for a negative index (property_list_helper.cpp:58), so TabBar::_set reports the key as unhandled and the value is silently dropped`,
  },
});

validatorRegistry.registerAll('TabBar', {
  // tab_bar.cpp:2123, PROPERTY_HINT_RANGE "-1,4096,1", both ends closed.
  // The two ends have different authority. FLOOR: every path into
  // `set_current_tab` that is not the literal -1 deselect sentinel falls to
  // `ERR_FAIL_INDEX(p_current, get_tab_count())` (tab_bar.cpp:804), which
  // refuses a negative index whatever the tab count is, so -2 and below are
  // enforced. -1 itself is guarded by `_can_deselect()` (tab_bar.cpp:798), a
  // check against the sibling tabs' disabled/hidden state that no
  // per-property validator can see, and it passes trivially while the tab
  // vector is still empty at load, so -1 is accepted here.
  // CEILING: 4096 exists only in the hint, and the setter assigns straight
  // through once the index is in range, so it is a warning.
  current_tab: v.int('current_tab', {
    min: -1,
    max: 4096,
    enforced: { min: 'tab_bar.cpp:804' },
    hinted: { max: 'tab_bar.cpp:2123' },
  }),
  // tab_bar.cpp:2124, PROPERTY_HINT_ENUM "Left,Center,Right".
  // `ERR_FAIL_INDEX(p_alignment, ALIGNMENT_MAX)` (tab_bar.cpp:1671) refuses
  // both ends, so both are enforced: ALIGNMENT_MAX is 3 (tab_bar.h:47), and
  // ERR_FAIL_INDEX also rejects a negative index.
  tab_alignment: v.enumInt(
    'tab_alignment',
    0,
    2,
    { 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT' },
    { enforced: 'tab_bar.cpp:1671' }
  ),
  // tab_bar.cpp:2127, PROPERTY_HINT_ENUM "Show Never,Show Active Only,Show
  // Always". Same shape: `ERR_FAIL_INDEX(p_policy, CLOSE_BUTTON_MAX)`
  // (tab_bar.cpp:1944), CLOSE_BUTTON_MAX is 3 (tab_bar.h:54).
  tab_close_display_policy: v.enumInt(
    'tab_close_display_policy',
    0,
    2,
    { 0: 'SHOW_NEVER', 1: 'SHOW_ACTIVE_ONLY', 2: 'SHOW_ALWAYS' },
    { enforced: 'tab_bar.cpp:1944' }
  ),
  // tab_bar.cpp:2128, PROPERTY_HINT_RANGE "0,99999,1,suffix:px". No
  // `or_greater`, so both ends are closed, but only the floor is real:
  // `set_max_tab_width` is `ERR_FAIL_COND(p_width < 0)` (tab_bar.cpp:1966)
  // and then a bare assignment, so a width past 99999 is applied verbatim and
  // only the inspector widget objects.
  max_tab_width: v.int('max_tab_width', {
    min: 0,
    max: 99999,
    enforced: { min: 'tab_bar.cpp:1966' },
    hinted: { max: 'tab_bar.cpp:2128' },
  }),
  // tab_bar.cpp:2132, Variant::INT with no hint at all. `set_tabs_rearrange_group`
  // (tab_bar.cpp:2004) is a bare assignment, and -1 (the "not in any group"
  // default) is a legal value, so neither end is bounded: format only.
  tabs_rearrange_group: v.int('tabs_rearrange_group'),

  // The eight Variant::BOOL properties, tab_bar.cpp:2125, 2126, 2129, 2130,
  // 2131, 2133, 2134, 2135. Every setter is a plain assignment past at most an
  // equality early-out, so `true`/`false` is the whole constraint.
  clip_tabs: v.boolean('clip_tabs'),
  close_with_middle_mouse: v.boolean('close_with_middle_mouse'),
  scrolling_enabled: v.boolean('scrolling_enabled'),
  drag_to_rearrange_enabled: v.boolean('drag_to_rearrange_enabled'),
  switch_on_drag_hover: v.boolean('switch_on_drag_hover'),
  scroll_to_selected: v.boolean('scroll_to_selected'),
  select_with_rmb: v.boolean('select_with_rmb'),
  deselect_enabled: v.boolean('deselect_enabled'),

  // tab_bar.cpp:2137 `ADD_ARRAY_COUNT("Tabs", "tab_count", …)`, which expands to
  // an ordinary ADD_PROPERTY of Variant::INT with PROPERTY_HINT_NONE
  // (class_db.cpp:1492), so it serialises like any other int and carries no
  // hinted bound. `set_tab_count` opens with `ERR_FAIL_COND(p_count < 0)`
  // (tab_bar.cpp:745): the floor is enforced, and there is no ceiling.
  tab_count: v.int('tab_count', { min: 0, enforced: 'tab_bar.cpp:745' }),

  'tab_#/*': tabValidator,
});
