/**
 * AnimationPlayer strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 *
 * `speed_scale`, `autoplay`, and `root_node` keep bespoke validators
 * because they encode multi-branch business rules (zero-prohibition +
 * magnitude bounds for speed_scale; empty-string rejection for
 * autoplay/root_node after stripping quote characters).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const MIN_PLAYBACK_SPEED = 0.0001;
const MAX_PLAYBACK_SPEED = 1000;

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };

const speedScaleValidator: PropertyValidator = (key, value, line) => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return propertyError(key, line, `Property 'speed_scale' must be a number, got: "${value}"`, 'INVALID_SPEED_SCALE_FORMAT');
  }
  if (num === 0) {
    return propertyError(key, line, `Property 'speed_scale' cannot be 0 (got ${num}). Zero speed will prevent animation from advancing.`, 'INVALID_SPEED_SCALE_ZERO');
  }
  if (num > 0 && num < MIN_PLAYBACK_SPEED) {
    return propertyError(key, line, `Property 'speed_scale' is too small (${num}). Values less than ${MIN_PLAYBACK_SPEED} are impractical.`, 'INVALID_SPEED_SCALE_TOO_SMALL');
  }
  if (Math.abs(num) > MAX_PLAYBACK_SPEED) {
    return propertyError(key, line, `Property 'speed_scale' is too large (${num}). Values above ${MAX_PLAYBACK_SPEED} are impractical.`, 'INVALID_SPEED_SCALE_TOO_LARGE');
  }
  return null;
};

/** Bespoke: must be a non-empty string (quote-stripped). */
function nonEmptyQuotedString(
  _propertyName: string,
  emptyMessage: string,
  code: string
): PropertyValidator {
  return (key, value, line) => {
    const strValue = value.replace(/^["']|["']$/g, '').trim();
    if (strValue.length === 0) {
      return propertyError(key, line, emptyMessage, code);
    }
    return null;
  };
}

validatorRegistry.registerAll('AnimationPlayer', {
  speed_scale: speedScaleValidator,
  // Custom message preserves the legacy ">= 0" wording (the per-node test
  // asserts that exact phrase).
  playback_default_blend_time: v.float('playback_default_blend_time', {
    min: 0,
    message: "Property 'playback_default_blend_time' must be >= 0. Negative blend times are invalid.",
  }),
  playback_process_mode: v.enumInt('playback_process_mode', 0, 2, PROCESS_MODE),
  method_call_mode: v.enumInt('method_call_mode', 0, 1, METHOD_CALL_MODE),
  playback_active: v.boolean('playback_active'),
  autoplay: nonEmptyQuotedString(
    'autoplay',
    "Property 'autoplay' cannot be empty. Specify a valid animation name.",
    'INVALID_AUTOPLAY_EMPTY'
  ),
  current_animation: () => null,
  root_node: nonEmptyQuotedString(
    'root_node',
    "Property 'root_node' cannot be empty. Specify a valid NodePath.",
    'INVALID_ROOT_NODE_EMPTY'
  ),
  current_animation_length: v.float('current_animation_length', {
    min: 0,
    message: "Property 'current_animation_length' must be >= 0",
  }),
  current_animation_position: v.float('current_animation_position', {
    min: 0,
    message: "Property 'current_animation_position' must be >= 0",
  }),
});
