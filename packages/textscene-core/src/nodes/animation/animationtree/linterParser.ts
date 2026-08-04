/**
 * AnimationTree strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `tree_root`, `anim_player`, `root_motion_track`,
 * `advance_expression_base_node`, `root_node` keep bespoke validators
 * because the per-node tests assert a specific message wording ("must
 * be a SubResource or ExtResource reference", "must be a NodePath
 * reference") that differs from `v.resourceReference` /
 * `v.nodePath`'s built-in template.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };
const DISCRETE_MODE = { 0: 'DOMINANT', 1: 'RECESSIVE', 2: 'FORCE_CONTINUOUS' };

const RESOURCE_REGEX = /^(SubResource|ExtResource)\("([^"]+)"\)$/;
const NODEPATH_REGEX = /^NodePath\("([^"]*)"\)$/;

function resourceRef(name: string, code: string): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    if (!RESOURCE_REGEX.test(value.trim())) {
      return propertyError(key, line, `Property '${name}' must be a SubResource or ExtResource reference, got: "${value}"`, code);
    }
    return null;
  };
  validator.accepts = 'SubResource("id") or ExtResource("id")';
  return validator;
}

function nodePath(name: string, code: string): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    if (!NODEPATH_REGEX.test(value.trim())) {
      return propertyError(key, line, `Property '${name}' must be a NodePath reference, got: "${value}"`, code);
    }
    return null;
  };
  validator.accepts = 'NodePath("path/to/node")';
  return validator;
}

validatorRegistry.registerAll('AnimationTree', {
  tree_root: resourceRef('tree_root', 'INVALID_TREE_ROOT_FORMAT'),
  anim_player: nodePath('anim_player', 'INVALID_ANIM_PLAYER_FORMAT'),
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
  root_motion_track: nodePath('root_motion_track', 'INVALID_ROOT_MOTION_TRACK_FORMAT'),
  advance_expression_base_node: nodePath(
    'advance_expression_base_node',
    'INVALID_ADVANCE_EXPRESSION_BASE_NODE_FORMAT'
  ),
  // animation_mixer.cpp:542, ERR_FAIL_COND(p_audio_max_polyphony < 0 || ... > 128).
  // A prior 1..512 range rejected the legal value 0 and silently passed 129-511,
  // which the engine itself rejects.
  audio_max_polyphony: v.int('audio_max_polyphony', {
    min: 0,
    max: 128,
    enforced: 'animation_mixer.cpp:542',
  }),
  root_node: nodePath('root_node', 'INVALID_ROOT_NODE_FORMAT'),
  deterministic: v.boolean('deterministic'),
  reset_on_save: v.boolean('reset_on_save'),
  root_motion_local: v.boolean('root_motion_local'),
});
