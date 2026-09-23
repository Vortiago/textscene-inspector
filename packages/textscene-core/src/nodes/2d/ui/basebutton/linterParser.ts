/**
 * BaseButton's own validators, those doc/classes/BaseButton.xml lists without `overrides=`.
 * Control's keys arrive through the NODE_BASE_TYPES walk. `focus_mode` is `overrides="Control"`:
 * the constructor only changes its default (base_button.cpp:593), so its validator stays on Control.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Each own member, cited at its ADD_PROPERTY line in base_button.cpp.
validatorRegistry.registerAll('BaseButton', {
  // base_button.cpp:567
  disabled: v.boolean('disabled'),
  // base_button.cpp:568
  toggle_mode: v.boolean('toggle_mode'),
  // base_button.cpp:569
  button_pressed: v.boolean('button_pressed'),
  // base_button.cpp:570, PROPERTY_HINT_ENUM "Button Press,Button Release", bound at
  // base_button.cpp:586-587. set_action_mode (base_button.cpp:386-387) assigns
  // unconditionally, no ERR_FAIL.
  action_mode: v.enumInt(
    'action_mode',
    0,
    1,
    {
      0: 'ACTION_MODE_BUTTON_PRESS',
      1: 'ACTION_MODE_BUTTON_RELEASE',
    },
    { hinted: 'base_button.cpp:570' }
  ),
  // base_button.cpp:571, PROPERTY_HINT_FLAGS names 3 bits (1, 2, 4), but set_button_mask
  // (base_button.cpp:394-396) assigns with no clamp and MouseButtonMask reaches XBUTTON1/2
  // = 128/256 (doc/classes/@GlobalScope.xml). A FLAGS hint is no range, so no floor either:
  // format-only, any integer.
  button_mask: v.int('button_mask'),
  // base_button.cpp:572
  keep_pressed_outside: v.boolean('keep_pressed_outside'),
  // base_button.cpp:573, a ButtonGroup resource.
  button_group: v.resourceReference('button_group'),
  // base_button.cpp:576, a Shortcut resource.
  shortcut: v.resourceReference('shortcut'),
  // base_button.cpp:577
  shortcut_feedback: v.boolean('shortcut_feedback'),
  // base_button.cpp:578
  shortcut_in_tooltip: v.boolean('shortcut_in_tooltip'),
});
