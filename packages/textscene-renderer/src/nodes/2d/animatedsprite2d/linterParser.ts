/**
 * AnimatedSprite2D format validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// Vector2 format: Vector2(x, y)
const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('AnimatedSprite2D', {
  /**
   * Validate sprite_frames resource reference (REQUIRED)
   * Must be SubResource("id") or ExtResource("id")
   */
  'sprite_frames': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'sprite_frames' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPRITE_FRAMES_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate animation property
   * Must be a string (animation name)
   */
  'animation': (key, value, line) => {
    // Animation names are strings - accept any quoted string value
    // The actual existence validation is done in semantic linter
    if (typeof value !== 'string') {
      return {
        severity: 'error',
        message: `Property 'animation' must be a string, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ANIMATION_FORMAT',
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
   * Validate speed_scale property
   * Must be a float (can be negative for reverse playback)
   */
  'speed_scale': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_FORMAT',
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
   * Validate frame_progress property
   * Must be a float (typically 0-1, but validation for range is semantic)
   */
  'frame_progress': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'frame_progress' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRAME_PROGRESS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate autoplay property
   * Must be a string (animation name to auto-start)
   */
  'autoplay': (key, value, line) => {
    // Autoplay is a string - accept any quoted string value
    if (typeof value !== 'string') {
      return {
        severity: 'error',
        message: `Property 'autoplay' must be a string, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AUTOPLAY_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate playing property (DEPRECATED in Godot 4.0+)
   * Must be a boolean (true or false)
   */
  'playing': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'playing' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PLAYING_FORMAT',
      };
    }
    return null;
  },
});
