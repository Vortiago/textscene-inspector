/**
 * SplitContainer strict validators for linting.
 *
 * Declare only SplitContainer's OWN members — the 11 `doc/classes/SplitContainer.xml`
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * None of the 11 carries `PROPERTY_USAGE_NONE` in `scene/gui/split_container.cpp`'s
 * `_bind_methods` — including the deprecated singular `split_offset`, which is
 * `PROPERTY_USAGE_NO_EDITOR` only (hidden from the inspector, still reaches a
 * `.tscn`) — so all 11 get a validator.
 *
 * `dragger_visibility` is the one enum, and it is HINTED, not enforced: its
 * range is the three labels of the `PROPERTY_HINT_ENUM` at
 * `split_container.cpp:1298`, which is the only grounding ADR-0032's tier table
 * admits here. `set_dragger_visibility` (`split_container.cpp:1103-1109`)
 * assigns past an equality guard with no `ERR_FAIL_INDEX` and no clamp, so
 * there is no error tier, and the `BIND_ENUM_CONSTANT` list at `:1308-1310`
 * grounds nothing on its own — `slider`'s `ticks_position` refuses exactly that
 * basis. `action_mode` in `basebutton/linterParser.ts` is the same shape and is
 * grounded the same way, on its hint (`base_button.cpp:570`).
 *
 * Every other member is a plain BOOL or INT with no `PROPERTY_HINT_RANGE`, and
 * none of their setters (`set_collapsed`, `set_dragging_enabled`,
 * `set_vertical`, `set_touch_dragger_enabled`, `set_drag_area_margin_begin`,
 * `set_drag_area_margin_end`, `set_drag_area_offset`,
 * `set_drag_area_highlight_in_editor`, `set_split_offset`/`set_split_offsets`)
 * clamps its value — so they format-check only, per Control's
 * format-lenient philosophy.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v, accepts, propertyError } from '../../../../linter/validators/index.js';
import { packedArrayLiteral } from '../../../../godot/index.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const SPLIT_OFFSETS_FORMAT = 'INVALID_SPLIT_OFFSETS_FORMAT';
const SPLIT_OFFSETS_WRAPPER = packedArrayLiteral('PackedInt32Array');

/**
 * `PackedInt32Array(n, n, …)` — a per-dragger pixel offset list. Unlike
 * `v.packedVector2Array`'s coordinate PAIRS, there is no parity constraint:
 * `SplitContainer::set_split_offsets` (split_container.cpp:1071) accepts any
 * length, including one that doesn't match `valid_children.size() - 1` — a
 * mismatch just sets `split_offset_pending` and Godot re-derives the missing
 * entries at the next layout pass rather than rejecting the array.
 */
function splitOffsetsValidator(): PropertyValidator {
  const validator = accepts((key, value, line) => {
    const match = SPLIT_OFFSETS_WRAPPER.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property 'split_offsets' must be a PackedInt32Array like PackedInt32Array(0, 60), got: "${value}"`,
        SPLIT_OFFSETS_FORMAT
      );
    }
    const body = match[1]!.trim();
    if (body === '') return null;
    // The shared element grammar, as `tilemap` and `polygon2d` already read
    // their PackedInt32Array bodies. A hand-rolled `/^[+-]?\d+$/` is wrong in
    // both directions here, measured on 4.6.3: `PackedInt32Array(1.5, 0)` loads
    // as `[1, 0]` and `(2e3, 0)` as `[2000, 0]` — `_parse_construct<int32_t>`
    // takes any number token and narrows it — while `(+3, 0)` fails the load
    // outright, since `get_token` accepts no leading `+`.
    // One pass: unreadable by the tokenizer, or read and then narrowed
    // away (_parse_construct<int32_t>, variant_parser.cpp:1428-1430).
    const bad = badIntElement('split_offsets', key, line, body, {
        format: SPLIT_OFFSETS_FORMAT,
        value: 'INVALID_SPLIT_OFFSETS_VALUE',
    });
    return bad.error ?? bad.truncated;
  }, 'PackedInt32Array(n, n, …)');
  // An INT slot, not format-only: it rejects a literal the tokenizer reads, so
  // `variant.h:360-377` is its authority. `set_split_offsets`
  // (split_container.cpp:1071) accepts any length and any value, so there is no
  // bound here beyond that.
  return markIntSlot(validator);
}

validatorRegistry.registerAll('SplitContainer', {
  // split_container.cpp:1295 — ADD_PROPERTY(PropertyInfo(Variant::PACKED_INT32_ARRAY,
  // "split_offsets", PROPERTY_HINT_NONE, "suffix:px"), "set_split_offsets", "get_split_offsets");
  split_offsets: splitOffsetsValidator(),
  // split_container.cpp:1296 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "collapsed"), ...)
  collapsed: v.boolean('collapsed'),
  // split_container.cpp:1297 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dragging_enabled"), ...)
  dragging_enabled: v.boolean('dragging_enabled'),
  // split_container.cpp:1298 — ADD_PROPERTY(PropertyInfo(Variant::INT, "dragger_visibility",
  // PROPERTY_HINT_ENUM, "Visible,Hidden,Hidden and Collapsed"), ...); BIND_ENUM_CONSTANT
  // DRAGGER_VISIBLE=0, DRAGGER_HIDDEN=1, DRAGGER_HIDDEN_COLLAPSED=2 (cpp:1308-1310).
  // set_dragger_visibility (split_container.cpp:1103-1109) assigns unconditionally.
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
  // split_container.cpp:1299 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "vertical"), ...)
  vertical: v.boolean('vertical'),
  // split_container.cpp:1300 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "touch_dragger_enabled"), ...)
  touch_dragger_enabled: v.boolean('touch_dragger_enabled'),
  // split_container.cpp:1303 — ADD_PROPERTY(PropertyInfo(Variant::INT, "drag_area_margin_begin",
  // PROPERTY_HINT_NONE, "suffix:px"), ...); set_drag_area_margin_begin (cpp:1186) assigns with no clamp.
  drag_area_margin_begin: v.int('drag_area_margin_begin'),
  // split_container.cpp:1304 — same shape, set_drag_area_margin_end (cpp:1198) has no clamp.
  drag_area_margin_end: v.int('drag_area_margin_end'),
  // split_container.cpp:1305 — same shape, set_drag_area_offset (cpp:1210) has no clamp.
  drag_area_offset: v.int('drag_area_offset'),
  // split_container.cpp:1306 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "drag_area_highlight_in_editor"), ...)
  drag_area_highlight_in_editor: v.boolean('drag_area_highlight_in_editor'),
  // split_container.cpp:1330 — deprecated compat property (guarded `#ifndef DISABLE_DEPRECATED`,
  // on by default), PROPERTY_USAGE_NO_EDITOR only — not PROPERTY_USAGE_NONE, so it still
  // reaches a .tscn. `_set_split_offset_first` (split_container.h:200) forwards to
  // `set_split_offset(p_offset, 0)` (cpp:1056), which has no clamp on the offset value either.
  split_offset: v.int('split_offset'),
});
