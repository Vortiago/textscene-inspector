/**
 * AnimationTree strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `tree_root` keeps a bespoke validator: linter.test.ts:90 pins the
 * contiguous substring "SubResource or ExtResource" in its diagnostic,
 * which `v.resourceReference`'s "SubResource(\"id\") or ExtResource(\"id\")"
 * template does not contain. `anim_player`, `root_motion_track`,
 * `advance_expression_base_node` and `root_node` moved to `v.nodePath`:
 * no test pins their old bespoke wording, and the regex is identical.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };
const DISCRETE_MODE = { 0: 'DOMINANT', 1: 'RECESSIVE', 2: 'FORCE_CONTINUOUS' };

const RESOURCE_REGEX = /^(SubResource|ExtResource)\("([^"]+)"\)$/;

function resourceRef(name: string, code: string): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    if (!RESOURCE_REGEX.test(value.trim())) {
      return propertyError(key, line, `Property '${name}' must be a SubResource or ExtResource reference, got: "${value}"`, code);
    }
    return null;
  };
  validator.accepts = 'SubResource("id") or ExtResource("id")';
  // animation_tree.cpp:1018, PROPERTY_HINT_RESOURCE_TYPE "AnimationRootNode":
  // rejects only a malformed reference, no magnitude to ground. Kept hand-rolled
  // (rather than v.resourceReference) because linter.test.ts:90 pins this exact
  // message substring.
  validator.formatOnly = true;
  return validator;
}

validatorRegistry.registerAll('AnimationTree', {
  tree_root: resourceRef('tree_root', 'INVALID_TREE_ROOT_FORMAT'),
  // animation_tree.cpp:1020, PROPERTY_HINT_NODE_PATH_VALID_TYPES "AnimationPlayer".
  // set_animation_player (:845-855) is a bare assignment (an empty path even
  // resets root_node/animation_libraries deliberately, not a rejection).
  anim_player: v.nodePath('anim_player'),
  active: v.boolean('active'),
  // animation_player.cpp:57-58, redirected through AnimationMixer's
  // callback_mode_process (animation_mixer.cpp:501-509): a bare assignment,
  // no engine-side range check on the raw int.
  process_callback: v.enumInt('process_callback', 0, 2, PROCESS_MODE, {
    hinted: 'animation_mixer.cpp:2471',
  }),
  callback_mode_process: v.enumInt('callback_mode_process', 0, 2, PROCESS_MODE, {
    hinted: 'animation_mixer.cpp:2471',
  }),
  callback_mode_method: v.enumInt('callback_mode_method', 0, 1, METHOD_CALL_MODE, {
    hinted: 'animation_mixer.cpp:2472',
  }),
  callback_mode_discrete: v.enumInt('callback_mode_discrete', 0, 2, DISCRETE_MODE, {
    hinted: 'animation_mixer.cpp:2473',
  }),
  // animation_mixer.cpp:2464, Variant::NODE_PATH, no hint text at all.
  // set_root_motion_track (:2074-2076) is a bare assignment.
  root_motion_track: v.nodePath('root_motion_track'),
  // animation_tree.cpp:1019, PROPERTY_HINT_NODE_PATH_VALID_TYPES "Node".
  // set_advance_expression_base_node (:697-699) is a bare assignment.
  advance_expression_base_node: v.nodePath('advance_expression_base_node'),
  // animation_mixer.cpp:542, ERR_FAIL_COND(p_audio_max_polyphony < 0 || ... > 128).
  // A prior 1..512 range rejected the legal value 0 and silently passed 129-511,
  // which the engine itself rejects.
  audio_max_polyphony: v.int('audio_max_polyphony', {
    min: 0,
    max: 128,
    enforced: 'animation_mixer.cpp:542',
  }),
  // animation_mixer.cpp:2461, Variant::NODE_PATH, no hint text at all.
  // set_root_node (:483-486) is a bare assignment; empty is accepted too.
  root_node: v.nodePath('root_node'),
  deterministic: v.boolean('deterministic'),
  reset_on_save: v.boolean('reset_on_save'),
  root_motion_local: v.boolean('root_motion_local'),
});
