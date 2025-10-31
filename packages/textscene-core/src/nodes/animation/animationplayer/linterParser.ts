/**
 * AnimationPlayer strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Constants for validation ranges
const MIN_PLAYBACK_SPEED = 0.0001;
const MAX_PLAYBACK_SPEED = 1000;

validatorRegistry.registerAll('AnimationPlayer', {
  /**
   * Validate speed_scale property
   * Must be > 0 (negative values are technically allowed in Godot but cause reverse playback)
   */
  'speed_scale': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_FORMAT',
      };
    }
    if (num === 0) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' cannot be 0 (got ${num}). Zero speed will prevent animation from advancing.`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_ZERO',
      };
    }
    if (num > 0 && num < MIN_PLAYBACK_SPEED) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' is too small (${num}). Values less than ${MIN_PLAYBACK_SPEED} are impractical.`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_TOO_SMALL',
      };
    }
    if (Math.abs(num) > MAX_PLAYBACK_SPEED) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' is too large (${num}). Values above ${MAX_PLAYBACK_SPEED} are impractical.`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_TOO_LARGE',
      };
    }
    return null;
  },

  /**
   * Validate playback_default_blend_time property
   * Must be >= 0 (blend time in seconds)
   */
  'playback_default_blend_time': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'playback_default_blend_time' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_BLEND_TIME_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'playback_default_blend_time' must be >= 0 (got ${num}). Negative blend times are invalid.`,
        line,
        column: key.length + 3,
        code: 'INVALID_BLEND_TIME_NEGATIVE',
      };
    }
    return null;
  },

  /**
   * Validate playback_process_mode property
   * Must be 0-2: PHYSICS=0, IDLE=1, MANUAL=2
   */
  'playback_process_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'playback_process_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'playback_process_mode' must be 0-2 (got ${num}). Valid values: 0=PHYSICS, 1=IDLE, 2=MANUAL`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate method_call_mode property
   * Must be 0-1: DEFERRED=0, IMMEDIATE=1
   */
  'method_call_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'method_call_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_METHOD_CALL_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'method_call_mode' must be 0-1 (got ${num}). Valid values: 0=DEFERRED, 1=IMMEDIATE`,
        line,
        column: key.length + 3,
        code: 'INVALID_METHOD_CALL_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate playback_active property
   * Must be a boolean (true or false)
   */
  'playback_active': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'playback_active' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLAYBACK_ACTIVE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate autoplay property
   * Must be a string (animation name) - format check only, semantic check in linter.ts
   */
  'autoplay': (key, value, line) => {
    // String validation - check if it's an empty string literal
    const strValue = value.replace(/^["']|["']$/g, '').trim();
    if (strValue.length === 0) {
      return {
        severity: 'error',
        message: `Property 'autoplay' cannot be empty. Specify a valid animation name.`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUTOPLAY_EMPTY',
      };
    }
    return null;
  },

  /**
   * Validate current_animation property
   * Must be a string (animation name) - can be empty to indicate no animation
   */
  'current_animation': (_key, _value, _line) => {
    // String value - no format constraints needed
    return null;
  },

  /**
   * Validate root_node property
   * Must be a NodePath string - semantic validation in linter.ts
   */
  'root_node': (key, value, line) => {
    // NodePath validation - must be a non-empty string
    const strValue = value.replace(/^["']|["']$/g, '').trim();
    if (strValue.length === 0) {
      return {
        severity: 'error',
        message: `Property 'root_node' cannot be empty. Specify a valid NodePath.`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROOT_NODE_EMPTY',
      };
    }
    return null;
  },

  /**
   * Validate current_animation_length property
   * Read-only runtime property, but if present must be >= 0
   */
  'current_animation_length': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'current_animation_length' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIMATION_LENGTH_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'current_animation_length' must be >= 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIMATION_LENGTH_NEGATIVE',
      };
    }
    return null;
  },

  /**
   * Validate current_animation_position property
   * Read-only runtime property, but if present must be >= 0
   */
  'current_animation_position': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'current_animation_position' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIMATION_POSITION_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'current_animation_position' must be >= 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIMATION_POSITION_NEGATIVE',
      };
    }
    return null;
  },
});
