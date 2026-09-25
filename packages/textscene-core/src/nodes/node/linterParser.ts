/**
 * Node strict validators. `Node` is the terminal of every `NODE_BASE_TYPES` walk, so these keys
 * reach every node type. `name`, `scene_file_path`, `owner` and `multiplayer` carry
 * PROPERTY_USAGE_NONE (node.cpp:4049, :4051, :4052, :4053), so they are never property lines: a
 * node's name and instance path live in its `[node …]` heading.
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../linter/validators/index.js';

validatorRegistry.registerAll('Node', {
  // node.cpp:4050: PROPERTY_USAGE_NO_EDITOR only hides it from the inspector, so it is serialised.
  unique_name_in_owner: v.boolean('unique_name_in_owner'),
  // node.cpp:4056: PROPERTY_HINT_ENUM "Inherit,Pausable,When Paused,Always,Disabled", from
  // PROCESS_MODE_INHERIT=0 to PROCESS_MODE_DISABLED=4 (scene/main/node.h:75-81). set_process_mode
  // (node.cpp:663-689) has no ERR_FAIL_INDEX on the raw int, only an ERR_FAIL_MSG for the root node
  // under INHERIT, so out of range is a warning, not an error.
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
  // node.cpp:4057: a bare INT with no hint, so no bound. Godot orders lower
  // priorities first and negatives are ordinary.
  process_priority: v.int('process_priority'),
  // node.cpp:4058: as above.
  process_physics_priority: v.int('process_physics_priority'),
  // node.cpp:4061: PROPERTY_HINT_ENUM "Inherit,Main Thread,Sub Thread".
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
  // node.cpp:4062: a bare INT with no hint.
  process_thread_group_order: v.int('process_thread_group_order'),
  // node.cpp:4063, PROPERTY_HINT_FLAGS "Process,Physics Process": a bitmask, so 1, 2 and 3 are the
  // legal set and a `max` would pass an in-range non-subset. set_process_thread_messages
  // (node.cpp:1233-1240) bare-assigns with no mask, and node.h:89-93 declares no bit outside the
  // hint, so an unlisted bit is kept but unreachable from the inspector: the hint's warning tier.
  process_thread_messages: hintedBitField('process_thread_messages', {
    hinted: 'node.cpp:4063',
    labels: {
      1: 'FLAG_PROCESS_THREAD_MESSAGES',
      2: 'FLAG_PROCESS_THREAD_MESSAGES_PHYSICS',
    },
  }),
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
  // node.cpp:4072: PROPERTY_HINT_MULTILINE_TEXT. The scanner accumulates the
  // continuation lines before validating, so the value arrives fully quoted.
  editor_description: v.quotedString('editor_description'),
});
