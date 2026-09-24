/**
 * SplitContainer strict validators: only the members `doc/classes/SplitContainer.xml` lists
 * without `overrides=`, since the NODE_BASE_TYPES base-walk delivers inherited keys and a
 * re-declared one shadows its rule. No member is `PROPERTY_USAGE_NONE` in
 * `scene/gui/split_container.cpp`, and the BOOL and INT setters clamp nothing (format check only).
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v, accepts, propertyError } from '../../../../linter/validators/index.js';
import { packedArrayBody, packedArrayForms } from '../../../../godot/index.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const SPLIT_OFFSETS_FORMAT = 'INVALID_SPLIT_OFFSETS_FORMAT';
// All three spellings the slot converts: `can_convert_strict` lists ARRAY as a source for
// PACKED_INT32_ARRAY (variant.cpp:467-473), and `set_split_offsets` (split_container.cpp:1071)
// takes a `PackedInt32Array`, so the bare and typed arrays narrow as the constructor's elements
// do, under one element grammar.
const SPLIT_OFFSETS_FORMS = packedArrayForms('PackedInt32Array');

/**
 * `PackedInt32Array(n, n, …)`, one pixel offset per dragger, with no parity constraint:
 * `SplitContainer::set_split_offsets` (split_container.cpp:1071) accepts any length. A length other
 * than `valid_children.size() - 1` sets `split_offset_pending` rather than rejecting the array, and
 * the next layout pass re-derives the missing entries.
 */
function splitOffsetsValidator(): PropertyValidator {
  const validator = accepts((key, value, line) => {
    const matched = packedArrayBody(SPLIT_OFFSETS_FORMS, value);
    if (!matched) {
      return propertyError(
        key,
        line,
        `Property 'split_offsets' must be an int array like PackedInt32Array(0, 60), Array[int]([0, 60]) or [0, 60], got: "${value}"`,
        SPLIT_OFFSETS_FORMAT
      );
    }
    const body = matched.body;
    if (body === '') return null;
    // The shared element grammar, as `tilemap` and `polygon2d` read theirs. Measured on 4.6.3,
    // `(1.5, 0)` loads as `[1, 0]` and `(2e3, 0)` as `[2000, 0]` (_parse_construct<int32_t>,
    // variant_parser.cpp:1428-1430, narrows any number token), and `(+3, 0)` fails the load,
    // since `get_token` accepts no leading `+`, so `/^[+-]?\d+$/` is wrong both ways.
    const bad = badIntElement('split_offsets', key, line, body, {
        format: SPLIT_OFFSETS_FORMAT,
        value: 'INVALID_SPLIT_OFFSETS_VALUE',
    });
    return bad.error ?? bad.truncated;
  }, 'int array (PackedInt32Array(…), Array[int]([…]) or […])');
  // An INT slot, not format-only: it rejects a literal the tokenizer reads, so
  // `variant.h:360-377` is its authority. `set_split_offsets`
  // (split_container.cpp:1071) accepts any length and any value, so there is no
  // bound here beyond that.
  return markIntSlot(validator);
}

validatorRegistry.registerAll('SplitContainer', {
  // split_container.cpp:1295: ADD_PROPERTY(PropertyInfo(Variant::PACKED_INT32_ARRAY,
  // "split_offsets", PROPERTY_HINT_NONE, "suffix:px"), "set_split_offsets", "get_split_offsets");
  split_offsets: splitOffsetsValidator(),
  // split_container.cpp:1296: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "collapsed"), ...)
  collapsed: v.boolean('collapsed'),
  // split_container.cpp:1297: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dragging_enabled"), ...)
  dragging_enabled: v.boolean('dragging_enabled'),
  // split_container.cpp:1298: ADD_PROPERTY(PropertyInfo(Variant::INT, "dragger_visibility",
  // PROPERTY_HINT_ENUM, "Visible,Hidden,Hidden and Collapsed"), ...). set_dragger_visibility
  // (split_container.cpp:1103-1109) has no ERR_FAIL_INDEX or clamp, and BIND_ENUM_CONSTANT
  // (cpp:1308-1310) grounds nothing, so the hint warns, as for `action_mode` (`base_button.cpp:570`).
  dragger_visibility: v.enumInt(
    'dragger_visibility',
    0,
    2,
    {
      0: 'DRAGGER_VISIBLE',
      1: 'DRAGGER_HIDDEN',
      2: 'DRAGGER_HIDDEN_COLLAPSED',
    },
    { hinted: 'split_container.cpp:1298' }
  ),
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
