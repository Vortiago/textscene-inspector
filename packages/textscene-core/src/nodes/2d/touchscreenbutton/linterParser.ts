/**
 * TouchScreenButton strict validators. The nine `ADD_PROPERTY` calls (touch_screen_button.cpp:434-442)
 * are the whole own surface: no `PropertyListHelper`, `ADD_ARRAY_COUNT` or `_get_property_list`. The `_set`
 * override (touch_screen_button.h:74, touch_screen_button.cpp:392-402) is a load-only `DISABLE_DEPRECATED`
 * shim for Godot 3.x `normal`/`pressed` with no `_get`, so it serialises nothing and gets no validator.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// Own members only, those doc/classes/TouchScreenButton.xml lists without `overrides=`. Node2D's keys
// arrive through the NODE_BASE_TYPES walk, and a re-declared one shadows it and duplicates the rule.
validatorRegistry.registerAll('TouchScreenButton', {
  // touch_screen_button.cpp:434. set_texture_normal (cpp:35-47) assigns
  // straight through past an equality guard. The rest (dis)connects a
  // `changed` signal. PROPERTY_HINT_RESOURCE_TYPE "Texture2D" is an editor
  // picker filter only. Format-only, matching Sprite2D.texture.
  texture_normal: v.resourceReference('texture_normal'),
  // touch_screen_button.cpp:435. set_texture_pressed (cpp:53-65), same shape.
  texture_pressed: v.resourceReference('texture_pressed'),
  // touch_screen_button.cpp:436. set_bitmask (cpp:71-73) is a bare assignment.
  bitmask: v.resourceReference('bitmask'),
  // touch_screen_button.cpp:437. set_shape (cpp:79-91), same shape as the
  // textures (disconnects/reconnects `changed` on the old/new Shape2D).
  // Format-only, matching CollisionShape2D.shape.
  shape: v.resourceReference('shape'),
  // touch_screen_button.cpp:438. set_shape_centered (cpp:97-100) assigns
  // unconditionally.
  shape_centered: v.boolean('shape_centered'),
  // touch_screen_button.cpp:439. set_shape_visible (cpp:106-109) assigns
  // unconditionally.
  shape_visible: v.boolean('shape_visible'),
  // touch_screen_button.cpp:440. set_passby_press (cpp:383-385) assigns
  // unconditionally.
  passby_press: v.boolean('passby_press'),
  // touch_screen_button.cpp:441 declares STRING_NAME, but get_action returns String (cpp:224-226), so
  // Godot saves the plain quoted form. The parser also reads `&"…"`. set_action (cpp:220-222) assigns
  // unconditionally. The PROPERTY_HINT_INPUT_NAME "show_builtin,loose_mode" hint names an InputMap
  // action, which needs the project file, so only the literal's format is checked.
  action: v.stringName('action'),
  // touch_screen_button.cpp:442, PROPERTY_HINT_ENUM "Always,TouchScreen Only" (0-1), BIND_ENUM_CONSTANT at
  // cpp:447-448. set_visibility_mode (cpp:374-377) has no ERR_FAIL_INDEX and the header enum
  // (touch_screen_button.h:42-45) has no MAX sentinel, so out of range is only hinted: a warning.
  visibility_mode: v.enumInt(
    'visibility_mode',
    0,
    1,
    { 0: 'ALWAYS', 1: 'TOUCHSCREEN_ONLY' },
    { hinted: 'touch_screen_button.cpp:442' }
  ),
});
