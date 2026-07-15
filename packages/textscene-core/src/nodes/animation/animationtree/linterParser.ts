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
  return (key, value, line) => {
    if (!RESOURCE_REGEX.test(value.trim())) {
      return propertyError(key, line, `Property '${name}' must be a SubResource or ExtResource reference, got: "${value}"`, code);
    }
    return null;
  };
}

/** Two-bound int with distinct messages on each branch (legacy wording). */
const audioMaxPolyphony: PropertyValidator = (key, value, line) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return propertyError(key, line, `Property 'audio_max_polyphony' must be a number, got: "${value}"`, 'INVALID_AUDIO_MAX_POLYPHONY_FORMAT');
  }
  if (num < 1) {
    return propertyError(key, line, `Property 'audio_max_polyphony' must be >= 1 (got ${num}). Values below 1 cause runtime errors.`, 'INVALID_AUDIO_MAX_POLYPHONY_TOO_SMALL');
  }
  if (num > 512) {
    return propertyError(key, line, `Property 'audio_max_polyphony' is impractically large (${num}). Consider values below 512.`, 'INVALID_AUDIO_MAX_POLYPHONY_TOO_LARGE');
  }
  return null;
};

function nodePath(name: string, code: string): PropertyValidator {
  return (key, value, line) => {
    if (!NODEPATH_REGEX.test(value.trim())) {
      return propertyError(key, line, `Property '${name}' must be a NodePath reference, got: "${value}"`, code);
    }
    return null;
  };
}

validatorRegistry.registerAll('AnimationTree', {
  tree_root: resourceRef('tree_root', 'INVALID_TREE_ROOT_FORMAT'),
  anim_player: nodePath('anim_player', 'INVALID_ANIM_PLAYER_FORMAT'),
  active: v.boolean('active'),
  process_callback: v.enumInt('process_callback', 0, 2, PROCESS_MODE),
  callback_mode_process: v.enumInt('callback_mode_process', 0, 2, PROCESS_MODE),
  callback_mode_method: v.enumInt('callback_mode_method', 0, 1, METHOD_CALL_MODE),
  callback_mode_discrete: v.enumInt('callback_mode_discrete', 0, 2, DISCRETE_MODE),
  root_motion_track: nodePath('root_motion_track', 'INVALID_ROOT_MOTION_TRACK_FORMAT'),
  advance_expression_base_node: nodePath(
    'advance_expression_base_node',
    'INVALID_ADVANCE_EXPRESSION_BASE_NODE_FORMAT'
  ),
  audio_max_polyphony: audioMaxPolyphony,
  root_node: nodePath('root_node', 'INVALID_ROOT_NODE_FORMAT'),
  deterministic: v.boolean('deterministic'),
  reset_on_save: v.boolean('reset_on_save'),
  root_motion_local: v.boolean('root_motion_local'),
});
