/**
 * AnimationPlayer strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `autoplay` and `root_node` keep bespoke validators because they encode
 * empty-string rejection after stripping quote characters.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };

/** Bespoke: must be a non-empty string (quote-stripped). */
function nonEmptyQuotedString(
  _propertyName: string,
  emptyMessage: string,
  code: string
): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    const strValue = value.replace(/^["']|["']$/g, '').trim();
    if (strValue.length === 0) {
      return propertyError(key, line, emptyMessage, code);
    }
    return null;
  };
  validator.accepts = 'non-empty quoted string';
  return validator;
}

validatorRegistry.registerAll('AnimationPlayer', {
  // animation_player.cpp:1048, PROPERTY_HINT_RANGE "-4,4,0.001,or_less,or_greater":
  // both ends open, and set_speed_scale (:648) is a bare assignment, so the only
  // thing to reject is a non-number.
  speed_scale: v.float('speed_scale'),
  // animation_player.cpp:822 is a bare assignment, so the hint at :1046
  // ("0,4096,0.01") is advisory: out-of-range is a warning in linter.ts.
  playback_default_blend_time: v.float('playback_default_blend_time'),
  playback_process_mode: v.enumInt('playback_process_mode', 0, 2, PROCESS_MODE),
  method_call_mode: v.enumInt('method_call_mode', 0, 1, METHOD_CALL_MODE),
  playback_active: v.boolean('playback_active'),
  autoplay: nonEmptyQuotedString(
    'autoplay',
    "Property 'autoplay' cannot be empty. Specify a valid animation name.",
    'INVALID_AUTOPLAY_EMPTY'
  ),
  current_animation: v.any(),
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
