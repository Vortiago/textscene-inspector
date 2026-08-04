/**
 * Node strict validators for linting.
 *
 * The root of every chain: `Node` is the terminal `NODE_BASE_TYPES` walks to,
 * so these ten keys reach every node type in the registry. They went
 * unvalidated entirely until this file existed, which is why a `process_mode`
 * of 99 was accepted on all 240 types at once. It is now REPORTED, as a
 * WARNING rather than an error: `set_process_mode` (node.cpp:663-689) carries
 * no `ERR_FAIL_INDEX` on the raw int, only a special-cased `ERR_FAIL_MSG` for
 * the root node under `PROCESS_MODE_INHERIT`, so Godot itself never refuses an
 * out-of-range value the way the four enums below never do either.
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

validatorRegistry.registerAll('Node', {
  // node.cpp:4050 — PROPERTY_USAGE_NO_EDITOR, still serialised.
  unique_name_in_owner: v.boolean('unique_name_in_owner'),
  // node.cpp:4056 — PROPERTY_HINT_ENUM "Inherit,Pausable,When Paused,Always,Disabled";
  // ProcessMode PROCESS_MODE_INHERIT=0 … PROCESS_MODE_DISABLED=4
  // (scene/main/node.h:75-81). set_process_mode (node.cpp:663-689) has no
  // ERR_FAIL_INDEX on the raw int, only a special-cased ERR_FAIL_MSG for the
  // root node under INHERIT, so out-of-range is a warning, not an error.
  process_mode: v.enumInt(
    'process_mode',
    0,
    4,
    {
      0: 'PROCESS_MODE_INHERIT',
      1: 'PROCESS_MODE_PAUSABLE',
      2: 'PROCESS_MODE_WHEN_PAUSED',
      3: 'PROCESS_MODE_ALWAYS',
      4: 'PROCESS_MODE_DISABLED',
    },
    { hinted: 'node.cpp:4056' }
  ),
  // node.cpp:4057 — a bare INT with no hint, so no bound. Godot orders lower
  // priorities first and negatives are ordinary.
  process_priority: v.int('process_priority'),
  // node.cpp:4058 — as above.
  process_physics_priority: v.int('process_physics_priority'),
  // node.cpp:4061 — PROPERTY_HINT_ENUM "Inherit,Main Thread,Sub Thread".
  // set_process_thread_group (node.cpp:1194-1223) is a bare assignment (plus an
  // equal-check and a main-thread guard); no engine-side range check.
  process_thread_group: v.enumInt(
    'process_thread_group',
    0,
    2,
    {
      0: 'PROCESS_THREAD_GROUP_INHERIT',
      1: 'PROCESS_THREAD_GROUP_MAIN_THREAD',
      2: 'PROCESS_THREAD_GROUP_SUB_THREAD',
    },
    { hinted: 'node.cpp:4061' }
  ),
  // node.cpp:4062 — a bare INT with no hint.
  process_thread_group_order: v.int('process_thread_group_order'),
  // node.cpp:4063, PROPERTY_HINT_FLAGS "Process,Physics Process": a 2-bit
  // BITMASK, not a linear range (valid combinations are 0-3). `min: 0` was a
  // shape nicety that could never reject an out-of-range combination anyway
  // (there is no `max`), so there is nothing left to bound.
  process_thread_messages: v.int('process_thread_messages'),
  // node.cpp:4066, PROPERTY_HINT_ENUM "Inherit,On,Off". set_physics_interpolation_mode
  // (node.cpp:935-949) is a bare assignment; no engine-side range check.
  physics_interpolation_mode: v.enumInt(
    'physics_interpolation_mode',
    0,
    2,
    {
      0: 'PHYSICS_INTERPOLATION_MODE_INHERIT',
      1: 'PHYSICS_INTERPOLATION_MODE_ON',
      2: 'PHYSICS_INTERPOLATION_MODE_OFF',
    },
    { hinted: 'node.cpp:4066' }
  ),
  // node.cpp:4069, PROPERTY_HINT_ENUM "Inherit,Always,Disabled". set_auto_translate_mode
  // (node.cpp:1331-1340) is a bare assignment plus a special-cased ERR_FAIL_MSG
  // for the root node under INHERIT; no range check on the raw int.
  auto_translate_mode: v.enumInt(
    'auto_translate_mode',
    0,
    2,
    {
      0: 'AUTO_TRANSLATE_MODE_INHERIT',
      1: 'AUTO_TRANSLATE_MODE_ALWAYS',
      2: 'AUTO_TRANSLATE_MODE_DISABLED',
    },
    { hinted: 'node.cpp:4069' }
  ),
  // node.cpp:4072 — PROPERTY_HINT_MULTILINE_TEXT. The scanner accumulates the
  // continuation lines before validating, so the value arrives fully quoted.
  editor_description: v.quotedString('editor_description'),
});
