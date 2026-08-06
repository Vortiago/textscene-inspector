/**
 * GraphNode strict validators for linting.
 *
 * Declare only GraphNode's OWN members — the ones doc/classes/GraphNode.xml
 * lists without an `overrides=` attribute — plus one family the XML omits but
 * the .cpp genuinely serialises, only visible by reading `_get_property_list`/
 * `_set`/`_get` rather than `ADD_PROPERTY` (the same shape PhysicalBone3D's
 * `joint_constraints/...` already established in this repo):
 *
 *   - `slot/<index>/<leaf>`: 9 leaves per child Control (graph_node.cpp:38-151),
 *     never an `ADD_PROPERTY` and absent from the XML's `<members>`. Every leaf
 *     `PropertyInfo` defaults to `PROPERTY_USAGE_DEFAULT` (object.h:131), which
 *     carries `PROPERTY_USAGE_STORAGE`, and `SceneState::_parse_node` walks
 *     `Object::get_property_list()` — which `_get_property_list` extends —
 *     gated only on that flag (packed_scene.cpp:859,865). So these DO reach a
 *     `.tscn`; the "set_slot is a runtime method API with no serialised state"
 *     read is only true of the *bind_methods* surface, not of this override.
 *
 * `focus_mode` and `mouse_filter` carry `overrides="Control"` (default-value
 * overrides, not new properties) and are skipped. Everything from GraphElement
 * up is registered on the ancestor and delivered by the NODE_BASE_TYPES
 * base-walk, so re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../graphelement/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * The 9 `slot/<index>/<leaf>` leaves (graph_node.cpp:140-148, in
 * `_get_property_list`'s per-child loop). `_set` (graph_node.cpp:38-88) copies
 * each leaf into a local `Slot` and forwards the whole struct to `set_slot()`
 * unconditionally — no leaf value itself is ever range-checked or clamped, so
 * every leaf below is a plain format check, format-only by construction (the `v`
 * combinators with no bound auto-tag themselves; only `left_icon`/`right_icon`
 * are hand-rolled and tagged explicitly above).
 */
const SLOT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // graph_node.cpp:140,144 — Variant::BOOL, no hint.
  left_enabled: v.boolean('left_enabled'),
  right_enabled: v.boolean('right_enabled'),
  // graph_node.cpp:141,145 — Variant::INT, no hint. `set_slot_type_left`'s doc
  // ("negative disallows user-made connections") describes port-connection
  // BEHAVIOUR, not a bound `_set`/`set_slot` enforce — both assign straight
  // through, so this stays unbounded rather than floored at 0.
  left_type: v.int('left_type'),
  right_type: v.int('right_type'),
  // graph_node.cpp:142,146 — Variant::COLOR, no hint.
  left_color: v.color('left_color'),
  right_color: v.color('right_color'),
  // graph_node.cpp:143,147 — Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  left_icon: v.nullableResourceReference('left_icon'),
  right_icon: v.nullableResourceReference('right_icon'),
  // graph_node.cpp:148 — Variant::BOOL, no hint.
  draw_stylebox: v.boolean('draw_stylebox'),
};

/** `slot/<index>/<leaf>`, e.g. `slot/0/left_enabled`. Index may be negative in
 * the text (nothing stops an author from writing one); the leaf name is
 * whatever follows the second slash. */
const slotValidator = indexedFamilyValidator({
  prefix: 'slot/',
  leaves: SLOT_LEAVES,
  unknownCode: 'INVALID_SLOT_KEY',
  describes: 'slot',
  negativeIndex: {
    cite: 'graph_node.cpp:706',
    code: 'INVALID_SLOT_INDEX',
    message: (index) =>
      `Slot index ${index} must be >= 0. GraphNode::set_slot refuses a negative slot_index (graph_node.cpp:706), so this slot is never applied`,
  },
});

validatorRegistry.registerAll('GraphNode', {
  // graph_node.cpp:1299 — Variant::STRING, no hint. set_title (:1171-1174) assigns
  // straight through.
  title: v.quotedString('title'),
  // graph_node.cpp:1300 — Variant::BOOL, no hint. set_ignore_invalid_connection_type
  // (:969-971) assigns straight through.
  ignore_invalid_connection_type: v.boolean('ignore_invalid_connection_type'),
  // graph_node.cpp:1301 — PROPERTY_HINT_ENUM "Click:1,All:2,Accessibility:3", so the
  // hint itself only names 1-3. set_slots_focus_mode's ERR_FAIL_COND at
  // graph_node.cpp:1223 (`(int)p_focus_mode < 1 || (int)p_focus_mode > 3`) refuses
  // the write outside that same range, including Control's own FOCUS_NONE=0 — so
  // both ends are enforced, not merely hinted. The constructor default,
  // FOCUS_ACCESSIBILITY=3 (graph_node.h:90), sits inside the range.
  slots_focus_mode: v.enumInt(
    'slots_focus_mode',
    1,
    3,
    { 1: 'Click', 2: 'All', 3: 'Accessibility' },
    { enforced: 'graph_node.cpp:1223' }
  ),

  'slot/*': slotValidator,
});
