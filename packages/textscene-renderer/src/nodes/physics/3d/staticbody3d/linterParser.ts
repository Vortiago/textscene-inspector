/**
 * StaticBody3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// Vector3 format: Vector3(x, y, z) - three comma-separated numbers
const VECTOR3_REGEX = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Collision layer/mask bitmask maximum (20 bits: 2^20 - 1 = 1048575)
const MAX_BITMASK = 1048575;

validatorRegistry.registerAll('StaticBody3D', {
  /**
   * Validate physics_material_override resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'physics_material_override': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'physics_material_override' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PHYSICS_MATERIAL_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate constant_linear_velocity property
   * Must be Vector3(x, y, z)
   */
  'constant_linear_velocity': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'constant_linear_velocity' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CONSTANT_LINEAR_VELOCITY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate constant_angular_velocity property
   * Must be Vector3(x, y, z)
   */
  'constant_angular_velocity': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'constant_angular_velocity' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CONSTANT_ANGULAR_VELOCITY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate collision_layer property
   * Must be a valid bitmask (1-1048575 for bits 1-20)
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
   * Must be a valid bitmask (1-1048575 for bits 1-20)
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

  /**
   * Validate collision_priority property
   * Must be a float (typically in range 0-1, but any float is valid)
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
   * Validate disable_mode property
   * Must be 0-2:
   * 0 = REMOVE, 1 = MAKE_STATIC, 2 = KEEP_ACTIVE
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
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'disable_mode' must be 0-2 (got ${num}). Valid values: 0=REMOVE, 1=MAKE_STATIC, 2=KEEP_ACTIVE`,
        line,
        column: key.length + 3,
        code: 'INVALID_DISABLE_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate input_ray_pickable property
   * Must be a boolean (true or false)
   */
  'input_ray_pickable': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'input_ray_pickable' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_INPUT_RAY_PICKABLE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate input_capture_on_drag property
   * Must be a boolean (true or false)
   */
  'input_capture_on_drag': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'input_capture_on_drag' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_INPUT_CAPTURE_ON_DRAG_FORMAT',
      };
    }
    return null;
  },
});
