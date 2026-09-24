/**
 * GraphNode strict validators: only the members doc/classes/GraphNode.xml lists
 * without `overrides=` (so not `focus_mode` or `mouse_filter`), since the
 * NODE_BASE_TYPES walk delivers inherited keys and a re-declared key shadows one.
 */

import '../graphelement/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * The 9 `slot/<index>/<leaf>` leaves per child Control (graph_node.cpp:140-148), declared
 * only by `_get_property_list` (graph_node.cpp:38-151), never `ADD_PROPERTY` or the XML.
 * Each defaults to `PROPERTY_USAGE_DEFAULT` (object.h:131), which carries STORAGE, and
 * `SceneState::_parse_node` saves by that flag (packed_scene.cpp:859,865), so they reach a `.tscn`.
 */
const SLOT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // `_set` (graph_node.cpp:38-88) forwards each leaf to `set_slot()` unchecked, so each is format-only.
  // graph_node.cpp:140,144: Variant::BOOL, no hint.
  left_enabled: v.boolean('left_enabled'),
  right_enabled: v.boolean('right_enabled'),
  // graph_node.cpp:141,145: Variant::INT, no hint. `set_slot_type_left`'s doc
  // ("negative disallows user-made connections") describes connections, not a
  // bound: `_set` and `set_slot` assign straight through, so no floor at 0.
  left_type: v.int('left_type'),
  right_type: v.int('right_type'),
  // graph_node.cpp:142,146: Variant::COLOR, no hint.
  left_color: v.color('left_color'),
  right_color: v.color('right_color'),
  // graph_node.cpp:143,147: Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  left_icon: v.resourceReference('left_icon'),
  right_icon: v.resourceReference('right_icon'),
  // graph_node.cpp:148: Variant::BOOL, no hint.
  draw_stylebox: v.boolean('draw_stylebox'),
};

/** `slot/<index>/<leaf>`, for example `slot/0/left_enabled`. The text may hold a
 * negative index; the leaf is whatever follows the second slash. */
const slotValidator = indexedFamilyValidator({
  prefix: 'slot/',
  leaves: SLOT_LEAVES,
  unknownCode: 'INVALID_SLOT_KEY',
  describes: 'slot',
  // `_set` (list declared at `graph_node.cpp:130`) reads the index with a bare
  // `str.get_slicec('/', 1).to_int()` (`:45`) and no `is_valid_int` gate, so
  // `slot/x/left_enabled` writes slot 0. Stated, since a default cannot show the check.
  indexParse: 'to_int',
  negativeIndex: {
    cite: 'graph_node.cpp:706',
    code: 'INVALID_SLOT_INDEX',
    message: (index) =>
      `Slot index ${index} must be >= 0. GraphNode::set_slot refuses a negative slot_index (graph_node.cpp:706), so this slot is never applied`,
  },
});

validatorRegistry.registerAll('GraphNode', {
  // graph_node.cpp:1299: Variant::STRING, no hint. set_title (:1171-1174) assigns
  // straight through.
  title: v.quotedString('title'),
  // graph_node.cpp:1300: Variant::BOOL, no hint. set_ignore_invalid_connection_type
  // (:969-971) assigns straight through.
  ignore_invalid_connection_type: v.boolean('ignore_invalid_connection_type'),
  // graph_node.cpp:1301: PROPERTY_HINT_ENUM "Click:1,All:2,Accessibility:3". The
  // ERR_FAIL_COND at graph_node.cpp:1223 (`(int)p_focus_mode < 1 || (int)p_focus_mode > 3`)
  // refuses anything else, FOCUS_NONE=0 included, so both ends are enforced. The
  // default, FOCUS_ACCESSIBILITY=3 (graph_node.h:90), is inside.
  slots_focus_mode: v.enumInt(
    'slots_focus_mode',
    1,
    3,
    { 1: 'Click', 2: 'All', 3: 'Accessibility' },
    { enforced: 'graph_node.cpp:1223' }
  ),

  'slot/*': slotValidator,
});
