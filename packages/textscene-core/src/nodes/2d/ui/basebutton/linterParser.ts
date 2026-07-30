/**
 * BaseButton strict validators for linting.
 *
 * Declare only BaseButton's OWN members — the ones doc/classes/BaseButton.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `focus_mode` is skipped: doc/classes/BaseButton.xml marks it
 * `overrides="Control"` — base_button.cpp's constructor only changes the
 * inherited default (`set_focus_mode(FOCUS_ALL)`, base_button.cpp:593), it
 * never re-declares the property with `ADD_PROPERTY`, so the validator
 * belongs to Control and would duplicate the rule here.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('BaseButton', {
  // base_button.cpp:567
  disabled: v.boolean('disabled'),
  // base_button.cpp:568
  toggle_mode: v.boolean('toggle_mode'),
  // base_button.cpp:569
  button_pressed: v.boolean('button_pressed'),
  // base_button.cpp:570 — PROPERTY_HINT_ENUM "Button Press,Button Release";
  // BIND_ENUM_CONSTANT ACTION_MODE_BUTTON_PRESS=0, ACTION_MODE_BUTTON_RELEASE=1
  // (base_button.cpp:586-587).
  action_mode: v.enumInt('action_mode', 0, 1, {
    0: 'ACTION_MODE_BUTTON_PRESS',
    1: 'ACTION_MODE_BUTTON_RELEASE',
  }),
  // base_button.cpp:571 — PROPERTY_HINT_FLAGS "Mouse Left, Mouse Right, Mouse
  // Middle" only names 3 bits (1, 2, 4) for the editor's checkbox UI, but
  // `BaseButton::set_button_mask` (base_button.cpp:394-396) assigns the
  // BitField straight through with no CLAMP, and MouseButtonMask itself
  // extends further (MOUSE_BUTTON_MASK_MB_XBUTTON1/2 = 128/256,
  // doc/classes/@GlobalScope.xml) — a wider mask than the hint parses fine in
  // the engine. Same call as layerBitmask.ts and PointLight2D's range_z_*:
  // an editor-hint width is an authoring aid, not a validity bound.
  button_mask: v.int('button_mask', { min: 0 }),
  // base_button.cpp:572
  keep_pressed_outside: v.boolean('keep_pressed_outside'),
  // base_button.cpp:573 — ButtonGroup resource.
  button_group: v.resourceReference('button_group'),
  // base_button.cpp:576 — Shortcut resource.
  shortcut: v.resourceReference('shortcut'),
  // base_button.cpp:577
  shortcut_feedback: v.boolean('shortcut_feedback'),
  // base_button.cpp:578
  shortcut_in_tooltip: v.boolean('shortcut_in_tooltip'),
});
