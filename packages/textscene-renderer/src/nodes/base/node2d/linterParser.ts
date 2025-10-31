/**
 * Node2D strict validators for linting
 *
 * Registers property validators that check format and value constraints for Node2D properties.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Vector2 format: Vector2(x, y) - two comma-separated numbers
const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Transform2D format: Transform2D(6 comma-separated numbers)
const TRANSFORM2D_REGEX = /^Transform2D\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Scale thresholds for warnings
const EXTREME_SCALE_MAX = 1000;
const EXTREME_SCALE_MIN = 0.001;

validatorRegistry.registerAll('Node2D', {
  /**
   * Validate position property
   * Must be Vector2(x, y)
   */
  'position': (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'position' must be Vector2 with 2 numbers like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_POSITION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation property
   * Must be a float (radians)
   */
  'rotation': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'rotation' must be a number (radians), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation_degrees property
   * Must be a float (degrees)
   */
  'rotation_degrees': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'rotation_degrees' must be a number (degrees), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_DEGREES_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate scale property
   * Must be Vector2(x, y) with non-zero values
   */
  'scale': (key, value, line) => {
    const match = VECTOR2_REGEX.exec(value);
    if (!match) {
      return {
        severity: 'error',
        message: `Property 'scale' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SCALE_FORMAT',
      };
    }

    // Extract scale values
    const x = parseFloat(match[1] || '0');
    const y = parseFloat(match[2] || '0');

    // Check for zero scale values (error - causes rendering issues)
    if (x === 0 || y === 0) {
      return {
        severity: 'error',
        message: `Property 'scale' must have non-zero values, got: Vector2(${x}, ${y}). Zero scale causes rendering issues.`,
        line,
        column: key.length + 3,
        code: 'INVALID_SCALE_VALUE',
      };
    }

    // Check for extreme scale values (warning)
    if (Math.abs(x) > EXTREME_SCALE_MAX || Math.abs(y) > EXTREME_SCALE_MAX) {
      return {
        severity: 'error',
        message: `Property 'scale' has extreme values (>${EXTREME_SCALE_MAX}): Vector2(${x}, ${y}). This may cause precision issues.`,
        line,
        column: key.length + 3,
        code: 'EXTREME_SCALE_VALUE',
      };
    }

    if (Math.abs(x) < EXTREME_SCALE_MIN || Math.abs(y) < EXTREME_SCALE_MIN) {
      return {
        severity: 'error',
        message: `Property 'scale' has extreme values (<${EXTREME_SCALE_MIN}): Vector2(${x}, ${y}). This may cause precision issues.`,
        line,
        column: key.length + 3,
        code: 'EXTREME_SCALE_VALUE',
      };
    }

    return null;
  },

  /**
   * Validate skew property
   * Must be a float (radians)
   */
  'skew': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'skew' must be a number (radians), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SKEW_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate transform property
   * Must be Transform2D(6 comma-separated numbers)
   */
  'transform': (key, value, line) => {
    if (!TRANSFORM2D_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'transform' must be Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRANSFORM_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_position property
   * Must be Vector2(x, y)
   */
  'global_position': (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_position' must be Vector2 with 2 numbers like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_POSITION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_rotation property
   * Must be a float (radians)
   */
  'global_rotation': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'global_rotation' must be a number (radians), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_ROTATION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_rotation_degrees property
   * Must be a float (degrees)
   */
  'global_rotation_degrees': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'global_rotation_degrees' must be a number (degrees), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_ROTATION_DEGREES_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_scale property
   * Must be Vector2(x, y)
   */
  'global_scale': (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_scale' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_SCALE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_skew property
   * Must be a float (radians)
   */
  'global_skew': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'global_skew' must be a number (radians), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_SKEW_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate global_transform property
   * Must be Transform2D(6 comma-separated numbers)
   */
  'global_transform': (key, value, line) => {
    if (!TRANSFORM2D_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'global_transform' must be Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_GLOBAL_TRANSFORM_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate z_index property
   * Must be an integer
   */
  'z_index': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || !Number.isInteger(parseFloat(value))) {
      return {
        severity: 'error',
        message: `Property 'z_index' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_Z_INDEX_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate z_as_relative property
   * Must be a boolean (true or false)
   */
  'z_as_relative': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'z_as_relative' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_Z_AS_RELATIVE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate y_sort_enabled property
   * Must be a boolean (true or false)
   */
  'y_sort_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'y_sort_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_Y_SORT_ENABLED_FORMAT',
      };
    }
    return null;
  },
});
