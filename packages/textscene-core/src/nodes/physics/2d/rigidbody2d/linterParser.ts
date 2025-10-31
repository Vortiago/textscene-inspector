/**
 * RigidBody2D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// Vector2 format: Vector2(x, y) - two comma-separated numbers
const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Collision layer/mask bitmask maximum (20 bits: 2^20 - 1 = 1048575)
const MAX_BITMASK = 1048575;

validatorRegistry.registerAll('RigidBody2D', {
  /**
   * Validate mass property
   * Must be a positive float (> 0) - physics doesn't work with zero/negative mass
   */
  'mass': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'mass' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MASS_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'mass' must be greater than 0, got: ${num}. Physics bodies require positive mass.`,
        line,
        column: key.length + 3,
        code: 'INVALID_MASS_VALUE',
      };
    }
    return null;
  },

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
   * Validate gravity_scale property
   * Must be a float (multiplier for gravity, typically 0-2, can be negative)
   */
  'gravity_scale': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'gravity_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GRAVITY_SCALE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate center_of_mass_mode property
   * Must be 0-1: 0 = AUTO, 1 = CUSTOM
   */
  'center_of_mass_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'center_of_mass_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CENTER_OF_MASS_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'center_of_mass_mode' must be 0-1 (got ${num}). Valid values: 0=AUTO, 1=CUSTOM`,
        line,
        column: key.length + 3,
        code: 'INVALID_CENTER_OF_MASS_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate center_of_mass property
   * Must be Vector2(x, y) - 2D physics uses 2D vectors
   */
  'center_of_mass': (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'center_of_mass' must be Vector2 with 2 numbers like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CENTER_OF_MASS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate inertia property
   * In 2D physics, inertia is a scalar float (rotational mass around Z-axis), not a vector
   * Must be a float > 0 (or 0 for auto-compute)
   */
  'inertia': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'inertia' must be a number, got: "${value}". In 2D, inertia is a scalar value.`,
        line,
        column: key.length + 3,
        code: 'INVALID_INERTIA_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'inertia' must be >= 0, got: ${num}. Use 0 for automatic calculation.`,
        line,
        column: key.length + 3,
        code: 'INVALID_INERTIA_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate linear_damp_mode property
   * Must be 0-1: 0 = COMBINE, 1 = REPLACE
   */
  'linear_damp_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'linear_damp_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LINEAR_DAMP_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'linear_damp_mode' must be 0-1 (got ${num}). Valid values: 0=COMBINE, 1=REPLACE`,
        line,
        column: key.length + 3,
        code: 'INVALID_LINEAR_DAMP_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate linear_damp property
   * Must be a float >= 0 (linear velocity damping)
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
   * Validate angular_damp_mode property
   * Must be 0-1: 0 = COMBINE, 1 = REPLACE
   */
  'angular_damp_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'angular_damp_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANGULAR_DAMP_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'angular_damp_mode' must be 0-1 (got ${num}). Valid values: 0=COMBINE, 1=REPLACE`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANGULAR_DAMP_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate angular_damp property
   * Must be a float >= 0 (angular velocity damping)
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

  /**
   * Validate lock_rotation property
   * Must be a boolean (true or false)
   */
  'lock_rotation': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'lock_rotation' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LOCK_ROTATION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate freeze property
   * Must be a boolean (true or false)
   */
  'freeze': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'freeze' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FREEZE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate contact_monitor property
   * Must be a boolean (true or false)
   */
  'contact_monitor': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'contact_monitor' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CONTACT_MONITOR_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate max_contacts_reported property
   * Must be an integer > 0
   */
  'max_contacts_reported': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'max_contacts_reported' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_CONTACTS_REPORTED_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'max_contacts_reported' must be greater than 0, got: ${num}`,
        line,
        column: key.length + 3,
        code: 'INVALID_MAX_CONTACTS_REPORTED_VALUE',
      };
    }
    return null;
  },
});
