/**
 * SplitContainer strict validators: only the members `doc/classes/SplitContainer.xml` lists
 * without `overrides=`, since the NODE_BASE_TYPES base-walk delivers inherited keys and a
 * re-declared one shadows its rule. No member is `PROPERTY_USAGE_NONE` in
 * `scene/gui/split_container.cpp`, and the BOOL and INT setters clamp nothing (format check only).
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { SPLIT_CONTAINER_DRAGGER_VISIBILITY_NAMES } from '../../../../godot/scene/gui.js';

validatorRegistry.registerAll('SplitContainer', {
  // split_container.cpp:1295. The setter takes any length and value (:1071).
  split_offsets: v.packedInt32Array('split_offsets'),
  // split_container.cpp:1296: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "collapsed"), ...)
  collapsed: v.boolean('collapsed'),
  // split_container.cpp:1297: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dragging_enabled"), ...)
  dragging_enabled: v.boolean('dragging_enabled'),
  // split_container.cpp:1298: ADD_PROPERTY(PropertyInfo(Variant::INT, "dragger_visibility",
  // PROPERTY_HINT_ENUM, "Visible,Hidden,Hidden and Collapsed"), ...). set_dragger_visibility
  // (split_container.cpp:1103-1109) has no ERR_FAIL_INDEX or clamp, and BIND_ENUM_CONSTANT
  // (cpp:1308-1310) grounds nothing, so the hint warns, as for `action_mode` (`base_button.cpp:570`).
  dragger_visibility: v.enumInt('dragger_visibility', SPLIT_CONTAINER_DRAGGER_VISIBILITY_NAMES, {
    hinted: 'split_container.cpp:1298',
  }),
  // split_container.cpp:1299: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "vertical"), ...)
  vertical: v.boolean('vertical'),
  // split_container.cpp:1300: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "touch_dragger_enabled"), ...)
  touch_dragger_enabled: v.boolean('touch_dragger_enabled'),
  // split_container.cpp:1303: ADD_PROPERTY(PropertyInfo(Variant::INT, "drag_area_margin_begin",
  // PROPERTY_HINT_NONE, "suffix:px"), ...); set_drag_area_margin_begin (cpp:1186) assigns with no clamp.
  drag_area_margin_begin: v.int('drag_area_margin_begin'),
  // split_container.cpp:1304: the same shape, and set_drag_area_margin_end (cpp:1198) has no clamp.
  drag_area_margin_end: v.int('drag_area_margin_end'),
  // split_container.cpp:1305: the same shape, and set_drag_area_offset (cpp:1210) has no clamp.
  drag_area_offset: v.int('drag_area_offset'),
  // split_container.cpp:1306: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "drag_area_highlight_in_editor"), ...)
  drag_area_highlight_in_editor: v.boolean('drag_area_highlight_in_editor'),
  // split_container.cpp:1330: a deprecated compat property (`#ifndef DISABLE_DEPRECATED`, on by
  // default), PROPERTY_USAGE_NO_EDITOR only, not PROPERTY_USAGE_NONE, so it reaches a .tscn. `_set_split_offset_first` (split_container.h:200) forwards to
  // `set_split_offset(p_offset, 0)` (cpp:1056), which has no clamp on the offset value either.
  split_offset: v.int('split_offset'),
});
