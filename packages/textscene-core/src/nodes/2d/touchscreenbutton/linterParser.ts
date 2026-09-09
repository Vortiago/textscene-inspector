/**
 * TouchScreenButton strict validators for linting.
 *
 * Declare only TouchScreenButton's OWN members — the ones doc/classes/TouchScreenButton.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All nine `ADD_PROPERTY` calls in `TouchScreenButton::_bind_methods`
 * (touch_screen_button.cpp:434-442) are the whole own surface: the class binds
 * no `PropertyListHelper`, no `ADD_ARRAY_COUNT` and no `_get_property_list`.
 * It does carry a `_set` override (touch_screen_button.h:74,
 * touch_screen_button.cpp:392-402), but it is a `DISABLE_DEPRECATED`
 * compatibility shim for Godot 3.x's `normal`/`pressed` keys — load-only, with
 * no matching `_get`, so it is never something the engine SERIALISES and gets
 * no validator here.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('TouchScreenButton', {
  // touch_screen_button.cpp:434. set_texture_normal (cpp:35-47) assigns
  // straight through past an equality guard; the rest just (dis)connects a
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
  // touch_screen_button.cpp:441, declared Variant::STRING_NAME with
  // PROPERTY_HINT_INPUT_NAME "show_builtin,loose_mode", but get_action returns
  // String (cpp:224-226), so Godot SAVES the plain quoted form; the variant
  // text parser also reads the `&"…"` StringName literal the declared type
  // suggests. Same getter-vs-declared-type gap as BoneAttachment3D.bone_name.
  // The hint only names an InputMap action for the editor's picker — this
  // linter has no project file in scope to resolve it against, so only the
  // literal's FORMAT is checked, never whether the action exists. set_action
  // (cpp:220-222) assigns unconditionally.
  action: v.stringName('action'),
  // touch_screen_button.cpp:442, PROPERTY_HINT_ENUM "Always,TouchScreen Only"
  // (2 labels, 0-1); BIND_ENUM_CONSTANT at cpp:447-448.
  // set_visibility_mode (cpp:374-377) assigns straight through with no
  // ERR_FAIL_INDEX, and the header enum (touch_screen_button.h:42-45) declares
  // no MAX sentinel — so out-of-range is only HINTED, a warning, same shape as
  // Window.mode.
  visibility_mode: v.enumInt(
    'visibility_mode',
    0,
    1,
    { 0: 'ALWAYS', 1: 'TOUCHSCREEN_ONLY' },
    { hinted: 'touch_screen_button.cpp:442' }
  ),
});
