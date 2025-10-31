/**
 * Camera3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Vector2 format: Vector2(x, y) - two comma-separated floats
const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('Camera3D', {
  /**
   * Validate projection property
   * Must be 0-2: PERSPECTIVE=0, ORTHOGONAL=1, FRUSTUM=2
   */
  'projection': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'projection' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROJECTION_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'projection' must be 0-2 (got ${num}). Valid values: 0=PERSPECTIVE, 1=ORTHOGONAL, 2=FRUSTUM`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROJECTION_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate fov property
   * Must be a float 1-179 degrees (required for PERSPECTIVE projection)
   */
  'fov': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'fov' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FOV_FORMAT',
      };
    }
    if (num < 1 || num > 179) {
      return {
        severity: 'error',
        message: `Property 'fov' must be between 1 and 179 degrees (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_FOV_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate size property
   * Must be a float > 0 (required for ORTHOGONAL projection)
   */
  'size': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'size' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SIZE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'size' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SIZE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate frustum_offset property
   * Must be Vector2(x, y)
   */
  'frustum_offset': (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'frustum_offset' must be Vector2 with 2 numbers like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRUSTUM_OFFSET_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate near property
   * Must be a float > 0
   */
  'near': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'near' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_NEAR_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'near' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_NEAR_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate far property
   * Must be a float > 0
   */
  'far': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'far' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FAR_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'far' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_FAR_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate keep_aspect property
   * Must be 0-2: KEEP_WIDTH=0, KEEP_HEIGHT=1, KEEP_ASPECT_DISABLED=2
   */
  'keep_aspect': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'keep_aspect' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_KEEP_ASPECT_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'keep_aspect' must be 0-2 (got ${num}). Valid values: 0=KEEP_WIDTH, 1=KEEP_HEIGHT, 2=KEEP_ASPECT_DISABLED`,
        line,
        column: key.length + 3,
        code: 'INVALID_KEEP_ASPECT_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate cull_mask property
   * Must be a valid bitmask (1-1048575 for bits 1-20)
   */
  'cull_mask': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'cull_mask' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CULL_MASK_FORMAT',
      };
    }
    if (num < 1 || num > 1048575) {
      return {
        severity: 'error',
        message: `Property 'cull_mask' must be between 1 and 1048575 (got ${num}). Valid range: bits 1-20`,
        line,
        column: key.length + 3,
        code: 'INVALID_CULL_MASK_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate doppler_tracking property
   * Must be 0-2: DISABLED=0, IDLE_STEP=1, PHYSICS_STEP=2
   */
  'doppler_tracking': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'doppler_tracking' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DOPPLER_TRACKING_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'doppler_tracking' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=IDLE_STEP, 2=PHYSICS_STEP`,
        line,
        column: key.length + 3,
        code: 'INVALID_DOPPLER_TRACKING_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate current property
   * Must be a boolean (true or false)
   */
  'current': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'current' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CURRENT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate h_offset property
   * Must be a float
   */
  'h_offset': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'h_offset' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_H_OFFSET_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate v_offset property
   * Must be a float
   */
  'v_offset': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'v_offset' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_V_OFFSET_FORMAT',
      };
    }
    return null;
  },
});
