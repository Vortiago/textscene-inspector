/**
 * Window strict validators: only Window's own members (doc/classes/Window.xml without
 * `overrides=`). Members from Node up, and Viewport's in `../../viewport/shared/linterParser.ts`,
 * arrive through the NODE_BASE_TYPES base walk. AcceptDialog, ConfirmationDialog, Popup,
 * PopupMenu, PopupPanel and FileDialog chain here.
 */

import '../../viewport/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { THEME_OVERRIDE_VALIDATORS } from '../../../linter/validators/themeOverrides.js';

// Re-declaring an inherited key shadows it and duplicates the rule. `auto_translate`
// has no validator: window.cpp's ADD_PROPERTY flags it PROPERTY_USAGE_NONE, so it is
// never serialised.
validatorRegistry.registerAll('Window', {
  // window.cpp:3422, PROPERTY_HINT_ENUM "Windowed,Minimized,Maximized,Fullscreen,Exclusive Fullscreen".
  // set_mode (window.cpp:523-531) assigns unconditionally, no ERR_FAIL.
  mode: v.enumInt(
    'mode',
    0,
    4,
    {
      0: 'WINDOWED',
      1: 'MINIMIZED',
      2: 'MAXIMIZED',
      3: 'FULLSCREEN',
      4: 'EXCLUSIVE_FULLSCREEN',
    },
    { hinted: 'window.cpp:3422' }
  ),
  title: v.quotedString('title'),
  // window.cpp:3427, PROPERTY_HINT_ENUM, 6 labels. set_initial_position
  // (window.cpp:331-337) assigns unconditionally, no ERR_FAIL.
  initial_position: v.enumInt(
    'initial_position',
    0,
    5,
    {
      0: 'ABSOLUTE',
      1: 'CENTER_PRIMARY_SCREEN',
      2: 'CENTER_MAIN_WINDOW_SCREEN',
      3: 'CENTER_OTHER_SCREEN',
      4: 'CENTER_SCREEN_WITH_MOUSE_FOCUS',
      5: 'CENTER_SCREEN_WITH_KEYBOARD_FOCUS',
    },
    { hinted: 'window.cpp:3427' }
  ),
  position: v.vector2i('position'),
  // set_size (window.cpp:401) bare-assigns, but calls _update_window_size, whose
  // `size = size.max(size_limit)` (window.cpp:1190) floors it: size_limit comes from
  // min_size, itself clamped to >= 0 by _clamp_limit_size. A negative size is altered.
  size: v.vector2i('size', { min: 0, enforced: 'window.cpp:1190' }),
  // window.cpp:3430, PROPERTY_HINT_RANGE "0,64,1,or_greater": 64 is a soft
  // editor bound (or_greater), so only the 0 floor is closed. set_current_screen
  // (window.cpp:344-351) assigns unconditionally, no clamp.
  current_screen: v.int('current_screen', { min: 0, hinted: 'window.cpp:3430' }),
  nonclient_area: v.rect2i('nonclient_area'),
  mouse_passthrough_polygon: v.packedVector2Array('mouse_passthrough_polygon'),

  // "Flags" group: every one an ADD_PROPERTYI(..., "set_flag", "get_flag", FLAG_*) bool.
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

  // "Limits" group. _clamp_limit_size (window.cpp:461-469) raises either component
  // to 0 in both its branches, so a negative limit never survives the setter.
  min_size: v.vector2i('min_size', { min: 0, enforced: 'window.cpp:465' }),
  max_size: v.vector2i('max_size', { min: 0, enforced: 'window.cpp:465' }),
  keep_title_visible: v.boolean('keep_title_visible'),

  // "Content Scale" group.
  // set_content_scale_size (window.cpp:1716-1717) ERR_FAIL_CONDs on either component < 0.
  content_scale_size: v.vector2i('content_scale_size', { min: 0, enforced: 'window.cpp:1716' }),
  // window.cpp:3463, PROPERTY_HINT_ENUM, 3 labels. set_content_scale_mode
  // (window.cpp:1727-1731) assigns unconditionally, no ERR_FAIL.
  content_scale_mode: v.enumInt(
    'content_scale_mode',
    0,
    2,
    {
      0: 'DISABLED',
      1: 'CANVAS_ITEMS',
      2: 'VIEWPORT',
    },
    { hinted: 'window.cpp:3463' }
  ),
  // window.cpp:3464, PROPERTY_HINT_ENUM, 5 labels. set_content_scale_aspect
  // (window.cpp:1738-1742) assigns unconditionally, no ERR_FAIL.
  content_scale_aspect: v.enumInt(
    'content_scale_aspect',
    0,
    4,
    {
      0: 'IGNORE',
      1: 'KEEP',
      2: 'KEEP_WIDTH',
      3: 'KEEP_HEIGHT',
      4: 'EXPAND',
    },
    { hinted: 'window.cpp:3464' }
  ),
  // window.cpp:3465, PROPERTY_HINT_ENUM, 2 labels. set_content_scale_stretch
  // (window.cpp:1749-1752) assigns unconditionally, no ERR_FAIL.
  content_scale_stretch: v.enumInt(
    'content_scale_stretch',
    0,
    1,
    {
      0: 'FRACTIONAL',
      1: 'INTEGER',
    },
    { hinted: 'window.cpp:3465' }
  ),
  // At or below 0 errors: set_content_scale_factor (window.cpp:1772-1776) only does
  // `ERR_FAIL_COND(p_factor <= 0)` (:1774). The hint's [0.5, 8.0] (window.cpp:3466)
  // warns on both sides. The floor to >= 1 under INTEGER stretch in
  // `_update_viewport_size` (window.cpp:1240-1247) is a side effect, not a bound.
  content_scale_factor: v.float('content_scale_factor', {
    enforcedMin: { at: 0, exclusive: true },
    min: 0.5,
    max: 8.0,
    enforced: { min: 'window.cpp:1774' },
    hinted: 'window.cpp:3466',
  }),

  // "Accessibility" group.
  accessibility_name: v.quotedString('accessibility_name'),
  accessibility_description: v.quotedString('accessibility_description'),

  // "Theme" group.
  // window.cpp:3477 is Control.theme's twin, down to the PropertyInfo.
  theme: v.resourceReference('theme'),
  // Godot serialises this StringName as `&"..."`, but the variant text parser also
  // accepts a plain `"..."`, which the setter casts, as the shared `busValidator` does.
  theme_type_variation: v.stringName('theme_type_variation'),

  // Shared with Control: Godot emits this family from both, identically.
  ...THEME_OVERRIDE_VALIDATORS,
});
