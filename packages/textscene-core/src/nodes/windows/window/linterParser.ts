/**
 * Window strict validators for linting.
 *
 * Declare only Window's OWN members — the ones doc/classes/Window.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Window extends Viewport (not modelled in this repo's base-type table — Window
 * chains straight to Node), so Viewport-level members are never Window's own.
 * `auto_translate` is skipped: window.cpp's ADD_PROPERTY flags it
 * PROPERTY_USAGE_NONE, so it is never serialised into a .tscn.
 *
 * Window is a base class for AcceptDialog/ConfirmationDialog/Popup/PopupMenu/
 * PopupPanel/FileDialog, which chain here rather than re-declaring these.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { THEME_OVERRIDE_VALIDATORS } from '../../../linter/validators/themeOverrides.js';

// `theme_type_variation` is a StringName: Godot always serialises it `&"..."`,
// but the variant text parser also accepts a plain `"..."` literal (it implicitly
// casts to StringName on the setter) — same leniency as the shared `busValidator`.

validatorRegistry.registerAll('Window', {
  // scene/main/window.cpp: ADD_PROPERTY(..., "mode", PROPERTY_HINT_ENUM, "Windowed,Minimized,Maximized,Fullscreen,Exclusive Fullscreen")
  mode: v.enumInt('mode', 0, 4, {
    0: 'WINDOWED',
    1: 'MINIMIZED',
    2: 'MAXIMIZED',
    3: 'FULLSCREEN',
    4: 'EXCLUSIVE_FULLSCREEN',
  }),
  title: v.quotedString('title'),
  // scene/main/window.cpp: ADD_PROPERTY(..., "initial_position", PROPERTY_HINT_ENUM, "Absolute,Center of Primary Screen,Center of Main Window Screen,Center of Other Screen,Center of Screen With Mouse Pointer,Center of Screen With Keyboard Focus")
  initial_position: v.enumInt('initial_position', 0, 5, {
    0: 'ABSOLUTE',
    1: 'CENTER_PRIMARY_SCREEN',
    2: 'CENTER_MAIN_WINDOW_SCREEN',
    3: 'CENTER_OTHER_SCREEN',
    4: 'CENTER_SCREEN_WITH_MOUSE_FOCUS',
    5: 'CENTER_SCREEN_WITH_KEYBOARD_FOCUS',
  }),
  position: v.vector2i('position'),
  // scene/main/window.cpp: _update_window_size(): `size = size.max(size_limit)`, and
  // size_limit derives from min_size (itself floor-clamped to 0 by _clamp_limit_size),
  // so a negative size set via the .tscn setter is immediately clamped back to >= 0
  size: v.vector2i('size', true),
  // scene/main/window.cpp: ADD_PROPERTY(..., "current_screen", PROPERTY_HINT_RANGE, "0,64,1,or_greater") — or_greater: 64 is a soft editor bound
  current_screen: v.int('current_screen', { min: 0 }),
  nonclient_area: v.rect2i('nonclient_area'),
  mouse_passthrough_polygon: v.packedVector2Array('mouse_passthrough_polygon'),

  // "Flags" group — every one an ADD_PROPERTYI(..., "set_flag", "get_flag", FLAG_*) bool.
  visible: v.boolean('visible'),
  wrap_controls: v.boolean('wrap_controls'),
  transient: v.boolean('transient'),
  transient_to_focused: v.boolean('transient_to_focused'),
  exclusive: v.boolean('exclusive'),
  unresizable: v.boolean('unresizable'),
  borderless: v.boolean('borderless'),
  always_on_top: v.boolean('always_on_top'),
  transparent: v.boolean('transparent'),
  unfocusable: v.boolean('unfocusable'),
  popup_window: v.boolean('popup_window'),
  extend_to_title: v.boolean('extend_to_title'),
  mouse_passthrough: v.boolean('mouse_passthrough'),
  sharp_corners: v.boolean('sharp_corners'),
  exclude_from_capture: v.boolean('exclude_from_capture'),
  popup_wm_hint: v.boolean('popup_wm_hint'),
  minimize_disabled: v.boolean('minimize_disabled'),
  maximize_disabled: v.boolean('maximize_disabled'),
  force_native: v.boolean('force_native'),

  // "Limits" group. min_size/max_size are clamped non-negative by _clamp_limit_size.
  min_size: v.vector2i('min_size', true),
  max_size: v.vector2i('max_size', true),
  keep_title_visible: v.boolean('keep_title_visible'),

  // "Content Scale" group.
  content_scale_size: v.vector2i('content_scale_size', true), // set_content_scale_size: ERR_FAIL_COND on either component < 0
  content_scale_mode: v.enumInt('content_scale_mode', 0, 2, {
    0: 'DISABLED',
    1: 'CANVAS_ITEMS',
    2: 'VIEWPORT',
  }),
  content_scale_aspect: v.enumInt('content_scale_aspect', 0, 4, {
    0: 'IGNORE',
    1: 'KEEP',
    2: 'KEEP_WIDTH',
    3: 'KEEP_HEIGHT',
    4: 'EXPAND',
  }),
  content_scale_stretch: v.enumInt('content_scale_stretch', 0, 1, {
    0: 'FRACTIONAL',
    1: 'INTEGER',
  }),
  // scene/main/window.cpp: ADD_PROPERTY(..., "content_scale_factor", PROPERTY_HINT_RANGE, "0.5,8.0,0.01") — both bounds hard, no or_greater
  content_scale_factor: v.float('content_scale_factor', { min: 0.5, max: 8.0 }),

  // "Accessibility" group.
  accessibility_name: v.quotedString('accessibility_name'),
  accessibility_description: v.quotedString('accessibility_description'),

  // "Theme" group.
  theme: v.resourceReference('theme'),
  theme_type_variation: v.stringName('theme_type_variation'),

  // Shared with Control — Godot emits this family from both, identically.
  ...THEME_OVERRIDE_VALIDATORS,
});
