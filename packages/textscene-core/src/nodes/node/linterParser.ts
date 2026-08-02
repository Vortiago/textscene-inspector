/**
 * Node strict validators for linting.
 *
 * The root of every chain: `Node` is the terminal `NODE_BASE_TYPES` walks to,
 * so these ten keys reach every node type in the registry. They went
 * unvalidated entirely until this file existed, which is why a `process_mode`
 * of 99 was accepted on all 240 types at once.
 *
 * Four of Node's fourteen bound members are deliberately absent, all by the
 * mechanical rules rather than by taste. `name`, `scene_file_path`, `owner` and
 * `multiplayer` carry PROPERTY_USAGE_NONE (node.cpp:4049, :4051, :4052, :4053),
 * so Godot never serialises them as property lines: a node's name and its
 * instance path live in the `[node …]` heading instead. `multiplayer` is also
 * getter-only. `unique_name_in_owner` is kept: PROPERTY_USAGE_NO_EDITOR
 * (node.cpp:4050) only hides a property from the inspector and does not stop it
 * being written, and the corpus carries 90 of them.
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

/** Inherit / on / off, the shape Godot reuses for per-node mode toggles. */
const INHERIT_ON_OFF = { 0: 'INHERIT', 1: 'ON', 2: 'OFF' };

validatorRegistry.registerAll('Node', {
  // node.cpp:4050 — PROPERTY_USAGE_NO_EDITOR, still serialised.
  unique_name_in_owner: v.boolean('unique_name_in_owner'),
  // node.cpp:4056 — PROPERTY_HINT_ENUM "Inherit,Pausable,When Paused,Always,Disabled";
  // ProcessMode PROCESS_MODE_INHERIT=0 … PROCESS_MODE_DISABLED=4
  // (scene/main/node.h:75-81).
  process_mode: v.enumInt('process_mode', 0, 4, {
    0: 'PROCESS_MODE_INHERIT',
    1: 'PROCESS_MODE_PAUSABLE',
    2: 'PROCESS_MODE_WHEN_PAUSED',
    3: 'PROCESS_MODE_ALWAYS',
    4: 'PROCESS_MODE_DISABLED',
  }),
  // node.cpp:4057 — a bare INT with no hint, so no bound. Godot orders lower
  // priorities first and negatives are ordinary.
  process_priority: v.int('process_priority'),
  // node.cpp:4058 — as above.
  process_physics_priority: v.int('process_physics_priority'),
  // node.cpp:4061 — PROPERTY_HINT_ENUM "Inherit,Main Thread,Sub Thread".
  process_thread_group: v.enumInt('process_thread_group', 0, 2, {
    0: 'PROCESS_THREAD_GROUP_INHERIT',
    1: 'PROCESS_THREAD_GROUP_MAIN_THREAD',
    2: 'PROCESS_THREAD_GROUP_SUB_THREAD',
  }),
  // node.cpp:4062 — a bare INT with no hint.
  process_thread_group_order: v.int('process_thread_group_order'),
  // node.cpp:4063 — PROPERTY_HINT_FLAGS "Process,Physics Process": a bitfield,
  // so the hint names bit positions rather than a range.
  process_thread_messages: v.int('process_thread_messages', { min: 0 }),
  // node.cpp:4066 — PROPERTY_HINT_ENUM "Inherit,On,Off".
  physics_interpolation_mode: v.enumInt('physics_interpolation_mode', 0, 2, INHERIT_ON_OFF),
  // node.cpp:4069 — PROPERTY_HINT_ENUM "Inherit,Always,Disabled".
  auto_translate_mode: v.enumInt('auto_translate_mode', 0, 2, {
    0: 'AUTO_TRANSLATE_MODE_INHERIT',
    1: 'AUTO_TRANSLATE_MODE_ALWAYS',
    2: 'AUTO_TRANSLATE_MODE_DISABLED',
  }),
  // node.cpp:4072 — PROPERTY_HINT_MULTILINE_TEXT. The scanner accumulates the
  // continuation lines before validating, so the value arrives fully quoted.
  editor_description: v.quotedString('editor_description'),
});
