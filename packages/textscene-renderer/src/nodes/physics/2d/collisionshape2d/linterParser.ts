/**
 * CollisionShape2D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// Color format: Color(r, g, b) or Color(r, g, b, a)
const COLOR_REGEX = /^Color\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/;

validatorRegistry.registerAll('CollisionShape2D', {
  /**
   * Validate shape resource reference (REQUIRED property)
   * Must be SubResource("id") or ExtResource("id")
   */
  'shape': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'shape' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHAPE_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate disabled property
   * Must be a boolean (true or false)
   */
  'disabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'disabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DISABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate one_way_collision property
   * Must be a boolean (true or false)
   */
  'one_way_collision': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'one_way_collision' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ONE_WAY_COLLISION_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate one_way_collision_margin property
   * Must be a non-negative float
   */
  'one_way_collision_margin': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'one_way_collision_margin' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ONE_WAY_COLLISION_MARGIN_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'one_way_collision_margin' must be non-negative (>= 0), got: ${num}`,
        line,
        column: key.length + 3,
        code: 'INVALID_ONE_WAY_COLLISION_MARGIN_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate debug_color property
   * Must be Color(r, g, b) or Color(r, g, b, a) format
   */
  'debug_color': (key, value, line) => {
    if (!COLOR_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'debug_color' must be in Color(r, g, b) or Color(r, g, b, a) format, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DEBUG_COLOR_FORMAT',
      };
    }
    return null;
  },
});
