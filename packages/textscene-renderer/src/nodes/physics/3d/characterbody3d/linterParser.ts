/**
 * CharacterBody3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Vector3 format: Vector3(x, y, z) - three comma-separated numbers
const VECTOR3_REGEX = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Collision layer/mask bitmask maximum (20 bits: 2^20 - 1 = 1048575)
const MAX_COLLISION_BITMASK = 1048575;

// Platform layer bitmask maximum (32 bits: 2^32 - 1 = 4294967295)
const MAX_PLATFORM_BITMASK = 4294967295;

validatorRegistry.registerAll('CharacterBody3D', {
  /**
   * Validate motion_mode property
   * Must be 0-1: 0 = GROUNDED, 1 = FLOATING
   */
  'motion_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'motion_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MOTION_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'motion_mode' must be 0-1 (got ${num}). Valid values: 0=GROUNDED, 1=FLOATING`,
        line,
        column: key.length + 3,
        code: 'INVALID_MOTION_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate up_direction property
   * Must be Vector3(x, y, z) - defines which way is "up"
   */
  'up_direction': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'up_direction' must be Vector3 with 3 numbers like Vector3(0, 1, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_UP_DIRECTION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate velocity property
   * Must be Vector3(x, y, z)
   */
  'velocity': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'velocity' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VELOCITY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate floor_stop_on_slope property
   * Must be a boolean (true or false)
   */
  'floor_stop_on_slope': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'floor_stop_on_slope' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_STOP_ON_SLOPE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate floor_constant_speed property
   * Must be a boolean (true or false)
   */
  'floor_constant_speed': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'floor_constant_speed' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_CONSTANT_SPEED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate floor_block_on_wall property
   * Must be a boolean (true or false)
   */
  'floor_block_on_wall': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'floor_block_on_wall' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_BLOCK_ON_WALL_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate floor_max_angle property
   * Must be a float between 0 and 90 degrees (in radians: 0 to ~1.5708)
   * Godot stores angles in radians, but we validate the degree equivalent
   */
  'floor_max_angle': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'floor_max_angle' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_MAX_ANGLE_FORMAT',
      };
    }
    // Godot uses radians: 90 degrees = PI/2 ≈ 1.5708
    // Add small epsilon for floating point comparison
    const maxRadians = Math.PI / 2 + 0.0001;
    if (num < 0 || num > maxRadians) {
      return {
        severity: 'error',
        message: `Property 'floor_max_angle' must be between 0 and ${(Math.PI / 2).toFixed(4)} radians (0-90 degrees), got: ${num}`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_MAX_ANGLE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate floor_snap_length property
   * Must be a float >= 0 (distance to snap to floor)
   */
  'floor_snap_length': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'floor_snap_length' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_SNAP_LENGTH_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'floor_snap_length' must be >= 0, got: ${num}`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLOOR_SNAP_LENGTH_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate wall_min_slide_angle property
   * Must be a float between 0 and 90 degrees (in radians: 0 to ~1.5708)
   */
  'wall_min_slide_angle': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'wall_min_slide_angle' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_WALL_MIN_SLIDE_ANGLE_FORMAT',
      };
    }
    // Godot uses radians: 90 degrees = PI/2 ≈ 1.5708
    // Add small epsilon for floating point comparison
    const maxRadians = Math.PI / 2 + 0.0001;
    if (num < 0 || num > maxRadians) {
      return {
        severity: 'error',
        message: `Property 'wall_min_slide_angle' must be between 0 and ${(Math.PI / 2).toFixed(4)} radians (0-90 degrees), got: ${num}`,
        line,
        column: key.length + 3,
        code: 'INVALID_WALL_MIN_SLIDE_ANGLE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate platform_on_leave property
   * Must be 0-2: 0 = ADD_VELOCITY, 1 = ADD_UPWARD_VELOCITY, 2 = DO_NOTHING
   */
  'platform_on_leave': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'platform_on_leave' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLATFORM_ON_LEAVE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'platform_on_leave' must be 0-2 (got ${num}). Valid values: 0=ADD_VELOCITY, 1=ADD_UPWARD_VELOCITY, 2=DO_NOTHING`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLATFORM_ON_LEAVE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate platform_floor_layers property
   * Must be a valid 32-bit bitmask (0-4294967295)
   */
  'platform_floor_layers': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'platform_floor_layers' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLATFORM_FLOOR_LAYERS_FORMAT',
      };
    }
    if (num < 0 || num > MAX_PLATFORM_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'platform_floor_layers' must be between 0 and ${MAX_PLATFORM_BITMASK} (got ${num}). Valid range: 32-bit bitmask`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLATFORM_FLOOR_LAYERS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate platform_wall_layers property
   * Must be a valid 32-bit bitmask (0-4294967295)
   */
  'platform_wall_layers': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'platform_wall_layers' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLATFORM_WALL_LAYERS_FORMAT',
      };
    }
    if (num < 0 || num > MAX_PLATFORM_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'platform_wall_layers' must be between 0 and ${MAX_PLATFORM_BITMASK} (got ${num}). Valid range: 32-bit bitmask`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLATFORM_WALL_LAYERS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate safe_margin property
   * Must be a float >= 0 (collision margin, typically 0.001-0.1)
   */
  'safe_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'safe_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SAFE_MARGIN_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'safe_margin' must be >= 0, got: ${num}`,
        line,
        column: key.length + 3,
        code: 'INVALID_SAFE_MARGIN_VALUE',
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
    if (num < 0 || num > MAX_COLLISION_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'collision_layer' must be between 0 and ${MAX_COLLISION_BITMASK} (got ${num}). Valid range: 20-bit bitmask`,
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
    if (num < 0 || num > MAX_COLLISION_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'collision_mask' must be between 0 and ${MAX_COLLISION_BITMASK} (got ${num}). Valid range: 20-bit bitmask`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_MASK_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate collision_priority property
   * Must be a float (used for solving collisions)
   */
  'collision_priority': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'collision_priority' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_PRIORITY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate max_slides property
   * Must be an integer > 0 (max collision iterations, typically 4-6)
   */
  'max_slides': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'max_slides' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_SLIDES_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'max_slides' must be greater than 0, got: ${num}. Character needs at least 1 slide iteration to function.`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_SLIDES_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate disable_mode property
   * Must be 0-1: 0 = REMOVE, 1 = KEEP_ACTIVE
   */
  'disable_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'disable_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DISABLE_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'disable_mode' must be 0-1 (got ${num}). Valid values: 0=REMOVE, 1=KEEP_ACTIVE`,
        line,
        column: key.length + 3,
        code: 'INVALID_DISABLE_MODE_VALUE',
      };
    }
    return null;
  },
});
