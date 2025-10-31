/**
 * Camera2D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Vector2 format: Vector2(x, y) - two comma-separated floats
const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('Camera2D', {
  /**
   * Validate anchor_mode property
   * Must be 0-1: FIXED_TOP_LEFT=0, DRAG_CENTER=1
   */
  'anchor_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'anchor_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANCHOR_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'anchor_mode' must be 0-1 (got ${num}). Valid values: 0=FIXED_TOP_LEFT, 1=DRAG_CENTER`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANCHOR_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate enabled property
   * Must be a boolean (true or false)
   */
  'enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate ignore_rotation property
   * Must be a boolean (true or false)
   */
  'ignore_rotation': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'ignore_rotation' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_IGNORE_ROTATION_FORMAT',
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
        message: `Property 'offset' must be Vector2 with 2 numbers like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OFFSET_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate zoom property
   * Must be Vector2(x, y) with positive components
   */
  'zoom': (key, value, line) => {
    const match = value.match(VECTOR2_REGEX);
    if (!match || !match[1] || !match[2]) {
      return {
        severity: 'error',
        message: `Property 'zoom' must be Vector2 with 2 numbers like Vector2(1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ZOOM_FORMAT',
      };
    }

    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);

    if (x <= 0 || y <= 0) {
      return {
        severity: 'error',
        message: `Property 'zoom' components must be greater than 0 (got Vector2(${x}, ${y})). Zero or negative zoom is invalid.`,
        line,
        column: key.length + 3,
        code: 'INVALID_ZOOM_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate process_callback property
   * Must be 0-1: PHYSICS=0, IDLE=1
   */
  'process_callback': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'process_callback' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_CALLBACK_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'process_callback' must be 0-1 (got ${num}). Valid values: 0=PHYSICS, 1=IDLE`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_CALLBACK_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate limit_left property
   * Must be an integer
   */
  'limit_left': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'limit_left' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIMIT_LEFT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate limit_top property
   * Must be an integer
   */
  'limit_top': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'limit_top' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIMIT_TOP_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate limit_right property
   * Must be an integer
   */
  'limit_right': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'limit_right' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIMIT_RIGHT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate limit_bottom property
   * Must be an integer
   */
  'limit_bottom': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'limit_bottom' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIMIT_BOTTOM_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate limit_smoothed property
   * Must be a boolean (true or false)
   */
  'limit_smoothed': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'limit_smoothed' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIMIT_SMOOTHED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate position_smoothing_enabled property
   * Must be a boolean (true or false)
   */
  'position_smoothing_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'position_smoothing_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_POSITION_SMOOTHING_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate position_smoothing_speed property
   * Must be a float > 0
   */
  'position_smoothing_speed': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'position_smoothing_speed' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_POSITION_SMOOTHING_SPEED_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'position_smoothing_speed' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_POSITION_SMOOTHING_SPEED_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate rotation_smoothing_enabled property
   * Must be a boolean (true or false)
   */
  'rotation_smoothing_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'rotation_smoothing_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_SMOOTHING_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation_smoothing_speed property
   * Must be a float > 0
   */
  'rotation_smoothing_speed': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'rotation_smoothing_speed' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_SMOOTHING_SPEED_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'rotation_smoothing_speed' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_SMOOTHING_SPEED_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate drag_horizontal_enabled property
   * Must be a boolean (true or false)
   */
  'drag_horizontal_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'drag_horizontal_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_HORIZONTAL_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate drag_vertical_enabled property
   * Must be a boolean (true or false)
   */
  'drag_vertical_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'drag_vertical_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_VERTICAL_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate drag_horizontal_offset property
   * Must be a float -1 to 1
   */
  'drag_horizontal_offset': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'drag_horizontal_offset' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_HORIZONTAL_OFFSET_FORMAT',
      };
    }
    if (num < -1 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'drag_horizontal_offset' must be between -1 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_HORIZONTAL_OFFSET_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate drag_vertical_offset property
   * Must be a float -1 to 1
   */
  'drag_vertical_offset': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'drag_vertical_offset' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_VERTICAL_OFFSET_FORMAT',
      };
    }
    if (num < -1 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'drag_vertical_offset' must be between -1 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_VERTICAL_OFFSET_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate drag_left_margin property
   * Must be a float 0-1
   */
  'drag_left_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'drag_left_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_LEFT_MARGIN_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'drag_left_margin' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_LEFT_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate drag_top_margin property
   * Must be a float 0-1
   */
  'drag_top_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'drag_top_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_TOP_MARGIN_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'drag_top_margin' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_TOP_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate drag_right_margin property
   * Must be a float 0-1
   */
  'drag_right_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'drag_right_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_RIGHT_MARGIN_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'drag_right_margin' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_RIGHT_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate drag_bottom_margin property
   * Must be a float 0-1
   */
  'drag_bottom_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'drag_bottom_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_BOTTOM_MARGIN_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'drag_bottom_margin' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAG_BOTTOM_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate editor_draw_screen property
   * Must be a boolean (true or false)
   */
  'editor_draw_screen': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'editor_draw_screen' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EDITOR_DRAW_SCREEN_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate editor_draw_limits property
   * Must be a boolean (true or false)
   */
  'editor_draw_limits': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'editor_draw_limits' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EDITOR_DRAW_LIMITS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate editor_draw_drag_margin property
   * Must be a boolean (true or false)
   */
  'editor_draw_drag_margin': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'editor_draw_drag_margin' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EDITOR_DRAW_DRAG_MARGIN_FORMAT',
      };
    }
    return null;
  },
});
