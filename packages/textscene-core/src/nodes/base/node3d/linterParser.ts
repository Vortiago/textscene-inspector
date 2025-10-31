/**
 * Node3D strict validators for linting
 *
 * Registers property validators that check format and value constraints for Node3D properties.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Vector3 format: Vector3(x, y, z) - three comma-separated numbers
const VECTOR3_REGEX = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Transform3D format: Transform3D(12 comma-separated numbers)
const TRANSFORM3D_REGEX = /^Transform3D\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Quaternion format: Quaternion(x, y, z, w) - four comma-separated numbers
const QUATERNION_REGEX = /^Quaternion\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// NodePath format: NodePath("path/to/node")
const NODEPATH_REGEX = /^NodePath\("([^"]*)"\)$/;

// Basis format: Basis(9 comma-separated numbers forming 3x3 matrix)
const BASIS_REGEX = /^Basis\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Scale thresholds for warnings
const EXTREME_SCALE_MAX = 1000;
const EXTREME_SCALE_MIN = 0.001;

validatorRegistry.registerAll('Node3D', {
  /**
   * Validate transform property
   * Must be Transform3D(12 comma-separated numbers)
   */
  'transform': (key, value, line) => {
    if (!TRANSFORM3D_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'transform' must be Transform3D with 12 numbers like Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRANSFORM_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_transform property
   * Must be Transform3D(12 comma-separated numbers)
   */
  'global_transform': (key, value, line) => {
    if (!TRANSFORM3D_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_transform' must be Transform3D with 12 numbers like Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_TRANSFORM_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate position property
   * Must be Vector3(x, y, z)
   */
  'position': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'position' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_POSITION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation property
   * Must be Vector3(x, y, z) with radians
   */
  'rotation': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'rotation' must be Vector3 with 3 numbers (radians) like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation_degrees property
   * Must be Vector3(x, y, z) with degrees (typically 0-360 range)
   */
  'rotation_degrees': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'rotation_degrees' must be Vector3 with 3 numbers (degrees) like Vector3(0, 90, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_DEGREES_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate scale property
   * Must be Vector3(x, y, z) with positive values
   */
  'scale': (key, value, line) => {
    const match = VECTOR3_REGEX.exec(value);
    if (!match) {
      return {
        severity: 'error',
        message: `Property 'scale' must be Vector3 with 3 numbers like Vector3(1, 1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SCALE_FORMAT',
      };
    }

    // Extract scale values
    const x = parseFloat(match[1] || '0');
    const y = parseFloat(match[2] || '0');
    const z = parseFloat(match[3] || '0');

    // Check for zero or negative scale values (error)
    if (x <= 0 || y <= 0 || z <= 0) {
      return {
        severity: 'error',
        message: `Property 'scale' must have positive values, got: Vector3(${x}, ${y}, ${z}). Zero or negative scale can cause rendering issues.`,
        line,
        column: key.length + 3,
        code: 'INVALID_SCALE_VALUE',
      };
    }

    // Check for extreme scale values (warning)
    if (x > EXTREME_SCALE_MAX || y > EXTREME_SCALE_MAX || z > EXTREME_SCALE_MAX) {
      return {
        severity: 'error',
        message: `Property 'scale' has extreme values (>${EXTREME_SCALE_MAX}): Vector3(${x}, ${y}, ${z}). This may cause precision issues.`,
        line,
        column: key.length + 3,
        code: 'EXTREME_SCALE_VALUE',
      };
    }

    if (x < EXTREME_SCALE_MIN || y < EXTREME_SCALE_MIN || z < EXTREME_SCALE_MIN) {
      return {
        severity: 'error',
        message: `Property 'scale' has extreme values (<${EXTREME_SCALE_MIN}): Vector3(${x}, ${y}, ${z}). This may cause precision issues.`,
        line,
        column: key.length + 3,
        code: 'EXTREME_SCALE_VALUE',
      };
    }

    return null;
  },

  /**
   * Validate quaternion property
   * Must be Quaternion(x, y, z, w)
   */
  'quaternion': (key, value, line) => {
    if (!QUATERNION_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'quaternion' must be Quaternion with 4 numbers like Quaternion(0, 0, 0, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_QUATERNION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate basis property
   * Must be Basis(9 comma-separated numbers)
   */
  'basis': (key, value, line) => {
    if (!BASIS_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'basis' must be Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_BASIS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_position property
   * Must be Vector3(x, y, z)
   */
  'global_position': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_position' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_POSITION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_rotation property
   * Must be Vector3(x, y, z) with radians
   */
  'global_rotation': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_rotation' must be Vector3 with 3 numbers (radians) like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_ROTATION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_rotation_degrees property
   * Must be Vector3(x, y, z) with degrees
   */
  'global_rotation_degrees': (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_rotation_degrees' must be Vector3 with 3 numbers (degrees) like Vector3(0, 90, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_ROTATION_DEGREES_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_basis property
   * Must be Basis(9 comma-separated numbers)
   */
  'global_basis': (key, value, line) => {
    if (!BASIS_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_basis' must be Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_BASIS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate visible property
   * Must be a boolean (true or false)
   */
  'visible': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'visible' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBLE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate top_level property
   * Must be a boolean (true or false)
   */
  'top_level': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'top_level' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TOP_LEVEL_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate visibility_parent property
   * Must be a valid NodePath like NodePath("path/to/node") or NodePath("")
   */
  'visibility_parent': (key, value, line) => {
    if (!NODEPATH_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'visibility_parent' must be a NodePath like NodePath("path/to/node"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_PARENT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation_order property
   * Must be a number from 0-5 representing rotation order enum:
   * 0 = XYZ, 1 = XZY, 2 = YXZ, 3 = YZX, 4 = ZXY, 5 = ZYX
   */
  'rotation_order': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'rotation_order' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_ORDER_FORMAT',
      };
    }
    if (num < 0 || num > 5) {
      return {
        severity: 'error',
        message: `Property 'rotation_order' must be 0-5 (got ${num}). Valid values: 0=XYZ, 1=XZY, 2=YXZ, 3=YZX, 4=ZXY, 5=ZYX`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_ORDER_VALUE',
      };
    }
    return null;
  },
});
