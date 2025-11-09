/**
 * Label3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Color format: Color(r, g, b, a) - four comma-separated floats 0-1
const COLOR_REGEX = /^Color\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('Label3D', {
  /**
   * Validate text property
   * Must be a quoted string
   */
  'text': (key, value, line) => {
    // Text should be a quoted string like "Hello World" or ""
    if (!value.startsWith('"') || !value.endsWith('"')) {
      return {
        severity: 'error',
        message: `Property 'text' must be a quoted string, got: ${value}`,
        line,
        column: key.length + 3,
        code: 'INVALID_TEXT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate pixel_size property
   * Must be a float > 0
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
   * Validate billboard property
   * Must be 0-2: DISABLED=0, ENABLED=1, FIXED_Y=2
   * (Mode 3 PARTICLES is not supported for Label3D)
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
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'billboard' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=ENABLED, 2=FIXED_Y`,
        line,
        column: key.length + 3,
        code: 'INVALID_BILLBOARD_VALUE',
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
        message: `Property 'modulate' must be Color with 4 numbers like Color(1, 1, 1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_MODULATE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate outline_size property
   * Must be a number >= 0
   */
  'outline_size': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'outline_size' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OUTLINE_SIZE_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'outline_size' must be >= 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_OUTLINE_SIZE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate outline_modulate property
   * Must be Color(r, g, b, a)
   */
  'outline_modulate': (key, value, line) => {
    if (!COLOR_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'outline_modulate' must be Color with 4 numbers like Color(0, 0, 0, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OUTLINE_MODULATE_FORMAT',
      };
    }
    return null;
  },
});
