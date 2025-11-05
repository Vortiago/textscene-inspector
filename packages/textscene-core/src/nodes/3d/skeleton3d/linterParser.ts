/**
 * Skeleton3D format validators for linting
 *
 * Validates property formats and value constraints for Skeleton3D nodes.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('Skeleton3D', {
  /**
   * Validate motion_scale property
   * Must be a positive float (> 0)
   */
  'motion_scale': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'motion_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MOTION_SCALE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'motion_scale' must be greater than 0 (got ${num}). A value of 0 or less prevents animations from applying.`,
        line,
        column: key.length + 3,
        code: 'INVALID_MOTION_SCALE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate show_rest_only property
   * Must be 'true' or 'false'
   */
  'show_rest_only': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'show_rest_only' must be true or false, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHOW_REST_ONLY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate animate_physical_bones property
   * Must be 'true' or 'false'
   */
  'animate_physical_bones': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'animate_physical_bones' must be true or false, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIMATE_PHYSICAL_BONES_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate modifier_callback_mode_process property
   * Must be 0-2:
   * 0 = MODIFIER_CALLBACK_MODE_PROCESS_PHYSICS
   * 1 = MODIFIER_CALLBACK_MODE_PROCESS_IDLE (default)
   * 2 = MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
   */
  'modifier_callback_mode_process': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'modifier_callback_mode_process' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MODIFIER_CALLBACK_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'modifier_callback_mode_process' must be 0-2 (got ${num}). Valid values: 0=PHYSICS, 1=IDLE, 2=MANUAL`,
        line,
        column: key.length + 3,
        code: 'INVALID_MODIFIER_CALLBACK_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate bone properties (indexed property)
   * Pattern: bones/0/position, bones/0/rotation, bones/0/scale, etc.
   */
  'bones/*': (key, value, line) => {
    // Extract bone index and property name
    // Note: \d+ will NOT match negative numbers, so -1 won't match the pattern
    const match = key.match(/^bones\/(\d+)\/(.+)$/);
    if (!match || !match[1] || !match[2]) {
      // Check if it's a negative index specifically
      const negativeMatch = key.match(/^bones\/(-\d+)\//);
      if (negativeMatch) {
        return {
          severity: 'error',
          message: `Bone index must be non-negative, got: ${negativeMatch[1]}`,
          line,
          column: 1,
          code: 'INVALID_BONE_INDEX',
        };
      }
      return {
        severity: 'error',
        message: `Invalid bone property key format: "${key}". Expected: bones/<number>/<property>`,
        line,
        column: 1,
        code: 'INVALID_BONE_PROPERTY_KEY',
      };
    }

    // Bone index is in match[1] if needed for future validation
    const propertyName = match[2];

    // Validate common bone property formats
    if (propertyName === 'position' || propertyName === 'scale') {
      // Must be Vector3 format: Vector3(x, y, z)
      const vector3Regex = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;
      if (!vector3Regex.test(value)) {
        return {
          severity: 'error',
          message: `Property '${key}' must be Vector3 format like Vector3(0, 0, 0), got: "${value}"`,
          line,
          column: key.length + 3,
          code: 'INVALID_BONE_VECTOR3_FORMAT',
        };
      }
    } else if (propertyName === 'rotation') {
      // Must be Quaternion format: Quaternion(x, y, z, w)
      const quaternionRegex = /^Quaternion\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;
      if (!quaternionRegex.test(value)) {
        return {
          severity: 'error',
          message: `Property '${key}' must be Quaternion format like Quaternion(0, 0, 0, 1), got: "${value}"`,
          line,
          column: key.length + 3,
          code: 'INVALID_BONE_QUATERNION_FORMAT',
        };
      }
    }

    return null;
  },
});
