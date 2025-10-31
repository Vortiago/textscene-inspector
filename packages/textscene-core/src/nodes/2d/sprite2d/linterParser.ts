/**
 * Sprite2D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// Vector2 format: Vector2(x, y)
const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Vector2i format: Vector2i(x, y)
const VECTOR2I_REGEX = /^Vector2i\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;

// Rect2 format: Rect2(x, y, width, height)
const RECT2_REGEX = /^Rect2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('Sprite2D', {
  /**
   * Validate texture resource reference (REQUIRED)
   * Must be SubResource("id") or ExtResource("id")
   */
  'texture': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'texture' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TEXTURE_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate centered property
   * Must be a boolean (true or false)
   */
  'centered': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'centered' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CENTERED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate offset property
   * Must be Vector2(x, y)
   */
  'offset': (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'offset' must be Vector2 format like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OFFSET_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate flip_h property
   * Must be a boolean (true or false)
   */
  'flip_h': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'flip_h' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLIP_H_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate flip_v property
   * Must be a boolean (true or false)
   */
  'flip_v': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'flip_v' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FLIP_V_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate region_enabled property
   * Must be a boolean (true or false)
   */
  'region_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'region_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_REGION_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate region_rect property
   * Must be Rect2(x, y, width, height)
   */
  'region_rect': (key, value, line) => {
    if (!RECT2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'region_rect' must be Rect2 format like Rect2(0, 0, 100, 100), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_REGION_RECT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate hframes property
   * Must be a positive integer (> 0) to prevent division by zero
   */
  'hframes': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'hframes' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_HFRAMES_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'hframes' must be greater than 0 (got ${num}). Zero or negative values cause division by zero.`,
        line,
        column: key.length + 3,
        code: 'INVALID_HFRAMES_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate vframes property
   * Must be a positive integer (> 0) to prevent division by zero
   */
  'vframes': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'vframes' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VFRAMES_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'vframes' must be greater than 0 (got ${num}). Zero or negative values cause division by zero.`,
        line,
        column: key.length + 3,
        code: 'INVALID_VFRAMES_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate frame property
   * Must be a non-negative integer (>= 0)
   */
  'frame': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || !Number.isInteger(parseFloat(value))) {
      return {
        severity: 'error',
        message: `Property 'frame' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRAME_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'frame' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRAME_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate frame_coords property
   * Must be Vector2i(x, y) with non-negative integers
   */
  'frame_coords': (key, value, line) => {
    const match = VECTOR2I_REGEX.exec(value);
    if (!match) {
      return {
        severity: 'error',
        message: `Property 'frame_coords' must be Vector2i format like Vector2i(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRAME_COORDS_FORMAT',
      };
    }

    // Extract coordinates
    const x = parseInt(match[1] || '0', 10);
    const y = parseInt(match[2] || '0', 10);

    // Check for negative values
    if (x < 0 || y < 0) {
      return {
        severity: 'error',
        message: `Property 'frame_coords' must have non-negative values, got: Vector2i(${x}, ${y})`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRAME_COORDS_VALUE',
      };
    }

    return null;
  },
});
