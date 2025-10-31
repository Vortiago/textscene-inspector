/**
 * Sprite3D strict validators for linting
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

// Color format: Color(r, g, b, a)
const COLOR_REGEX = /^Color\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('Sprite3D', {
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
   * Validate billboard property
   * Must be a number from 0-3:
   * 0 = DISABLED, 1 = ENABLED, 2 = FIXED_Y, 3 = PARTICLES
   */
  'billboard': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'billboard' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_BILLBOARD_FORMAT',
      };
    }
    if (num < 0 || num > 3) {
      return {
        severity: 'error',
        message: `Property 'billboard' must be 0-3 (got ${num}). Valid values: 0=DISABLED, 1=ENABLED, 2=FIXED_Y, 3=PARTICLES`,
        line,
        column: key.length + 3,
        code: 'INVALID_BILLBOARD_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate alpha_cut property
   * Must be a number from 0-2:
   * 0 = DISABLED, 1 = DISCARD, 2 = OPAQUE_PREPASS
   */
  'alpha_cut': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'alpha_cut' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ALPHA_CUT_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'alpha_cut' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=DISCARD, 2=OPAQUE_PREPASS`,
        line,
        column: key.length + 3,
        code: 'INVALID_ALPHA_CUT_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate axis property
   * Must be a number from 0-2:
   * 0 = X_AXIS, 1 = Y_AXIS, 2 = Z_AXIS
   */
  'axis': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'axis' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AXIS_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'axis' must be 0-2 (got ${num}). Valid values: 0=X_AXIS, 1=Y_AXIS, 2=Z_AXIS`,
        line,
        column: key.length + 3,
        code: 'INVALID_AXIS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate pixel_size property
   * Must be a positive float
   */
  'pixel_size': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'pixel_size' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PIXEL_SIZE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'pixel_size' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_PIXEL_SIZE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate transparency property
   * Must be a float from 0-1
   */
  'transparency': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'transparency' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRANSPARENCY_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'transparency' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRANSPARENCY_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate hframes property
   * Must be a positive integer
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
        message: `Property 'hframes' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_HFRAMES_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate vframes property
   * Must be a positive integer
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
        message: `Property 'vframes' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_VFRAMES_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate frame property
   * Must be a non-negative integer
   */
  'frame': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'frame' must be a number, got: "${value}"`,
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
   * Validate frame_coords property
   * Must be Vector2i(x, y)
   */
  'frame_coords': (key, value, line) => {
    if (!VECTOR2I_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'frame_coords' must be Vector2i format like Vector2i(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRAME_COORDS_FORMAT',
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
   * Validate modulate property
   * Must be Color(r, g, b, a)
   */
  'modulate': (key, value, line) => {
    if (!COLOR_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'modulate' must be Color format like Color(1, 1, 1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MODULATE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate render_priority property
   * Must be an integer
   */
  'render_priority': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'render_priority' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_RENDER_PRIORITY_FORMAT',
      };
    }
    return null;
  },
});
