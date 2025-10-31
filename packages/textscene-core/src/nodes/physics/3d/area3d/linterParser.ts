/**
 * Area3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Vector3 format: Vector3(x, y, z) - three comma-separated numbers
const VECTOR3_REGEX = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Collision layer/mask bitmask maximum (20 bits: 2^20 - 1 = 1048575)
const MAX_BITMASK = 1048575;

// Space override enum: 0-4
const SPACE_OVERRIDE_MIN = 0;
const SPACE_OVERRIDE_MAX = 4;

validatorRegistry.registerAll('Area3D', {
  /**
   * Validate monitoring property
   * Must be a boolean (true or false)
   */
  'monitoring': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'monitoring' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MONITORING_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate monitorable property
   * Must be a boolean (true or false)
   */
  'monitorable': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'monitorable' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MONITORABLE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate space_override property
   * Must be 0-4: 0=DISABLED, 1=COMBINE, 2=COMBINE_REPLACE, 3=REPLACE, 4=REPLACE_COMBINE
   */
  'space_override': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'space_override' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPACE_OVERRIDE_FORMAT',
      };
    }
    if (num < SPACE_OVERRIDE_MIN || num > SPACE_OVERRIDE_MAX) {
      return {
        severity: 'error',
        message: `Property 'space_override' must be 0-4 (got ${num}). Valid values: 0=DISABLED, 1=COMBINE, 2=COMBINE_REPLACE, 3=REPLACE, 4=REPLACE_COMBINE`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPACE_OVERRIDE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate gravity_space_override property
   * Must be 0-4: same values as space_override
   */
  'gravity_space_override': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'gravity_space_override' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_SPACE_OVERRIDE_FORMAT',
      };
    }
    if (num < SPACE_OVERRIDE_MIN || num > SPACE_OVERRIDE_MAX) {
      return {
        severity: 'error',
        message: `Property 'gravity_space_override' must be 0-4 (got ${num}). Valid values: 0=DISABLED, 1=COMBINE, 2=COMBINE_REPLACE, 3=REPLACE, 4=REPLACE_COMBINE`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_SPACE_OVERRIDE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate gravity_point property
   * Must be a boolean (true or false)
   */
  'gravity_point': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'gravity_point' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_POINT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate gravity_point_center property
   * Must be Vector3(x, y, z)
   */
  'gravity_point_center': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'gravity_point_center' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_POINT_CENTER_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate gravity_point_unit_distance property
   * Must be a float > 0 (distance for full gravity strength when using point gravity)
   */
  'gravity_point_unit_distance': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'gravity_point_unit_distance' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_POINT_UNIT_DISTANCE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'gravity_point_unit_distance' must be greater than 0, got: ${num}. This distance is required for point gravity calculations.`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_POINT_UNIT_DISTANCE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate gravity_direction property
   * Must be Vector3(x, y, z) - direction of directional gravity
   */
  'gravity_direction': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'gravity_direction' must be Vector3 with 3 numbers like Vector3(0, -1, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_DIRECTION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate gravity property
   * Must be a float (gravity strength, can be negative)
   */
  'gravity': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'gravity' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate linear_damp_space_override property
   * Must be 0-4: same values as space_override
   */
  'linear_damp_space_override': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'linear_damp_space_override' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LINEAR_DAMP_SPACE_OVERRIDE_FORMAT',
      };
    }
    if (num < SPACE_OVERRIDE_MIN || num > SPACE_OVERRIDE_MAX) {
      return {
        severity: 'error',
        message: `Property 'linear_damp_space_override' must be 0-4 (got ${num}). Valid values: 0=DISABLED, 1=COMBINE, 2=COMBINE_REPLACE, 3=REPLACE, 4=REPLACE_COMBINE`,
        line,
        column: key.length + 3,
        code: 'INVALID_LINEAR_DAMP_SPACE_OVERRIDE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate linear_damp property
   * Must be a float >= 0
   */
  'linear_damp': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'linear_damp' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LINEAR_DAMP_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'linear_damp' must be >= 0, got: ${num}. Damping cannot be negative.`,
        line,
        column: key.length + 3,
        code: 'INVALID_LINEAR_DAMP_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate angular_damp_space_override property
   * Must be 0-4: same values as space_override
   */
  'angular_damp_space_override': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'angular_damp_space_override' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANGULAR_DAMP_SPACE_OVERRIDE_FORMAT',
      };
    }
    if (num < SPACE_OVERRIDE_MIN || num > SPACE_OVERRIDE_MAX) {
      return {
        severity: 'error',
        message: `Property 'angular_damp_space_override' must be 0-4 (got ${num}). Valid values: 0=DISABLED, 1=COMBINE, 2=COMBINE_REPLACE, 3=REPLACE, 4=REPLACE_COMBINE`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANGULAR_DAMP_SPACE_OVERRIDE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate angular_damp property
   * Must be a float >= 0
   */
  'angular_damp': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'angular_damp' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANGULAR_DAMP_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'angular_damp' must be >= 0, got: ${num}. Damping cannot be negative.`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANGULAR_DAMP_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate priority property
   * Must be a float (higher priority areas override lower ones)
   */
  'priority': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'priority' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PRIORITY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate audio_bus_override property
   * Must be a boolean (true or false)
   */
  'audio_bus_override': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'audio_bus_override' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUDIO_BUS_OVERRIDE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate audio_bus_name property
   * Must be a string (name of audio bus)
   * Note: String values in TSCN are typically quoted, but we accept any string
   */
  'audio_bus_name': (key, value, line) => {
    // Audio bus names are strings - accept any non-empty value
    if (typeof value !== 'string' || value.trim().length === 0) {
      return {
        severity: 'error',
        message: `Property 'audio_bus_name' must be a non-empty string, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUDIO_BUS_NAME_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate collision_layer property
   * Must be a valid bitmask (0-1048575 for bits 1-20)
   */
  'collision_layer': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'collision_layer' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_LAYER_FORMAT',
      };
    }
    if (num < 0 || num > MAX_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'collision_layer' must be between 0 and ${MAX_BITMASK} (got ${num}). Valid range: 20-bit bitmask`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_LAYER_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate collision_mask property
   * Must be a valid bitmask (0-1048575 for bits 1-20)
   */
  'collision_mask': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'collision_mask' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_MASK_FORMAT',
      };
    }
    if (num < 0 || num > MAX_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'collision_mask' must be between 0 and ${MAX_BITMASK} (got ${num}). Valid range: 20-bit bitmask`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_MASK_VALUE',
      };
    }
    return null;
  },
});
