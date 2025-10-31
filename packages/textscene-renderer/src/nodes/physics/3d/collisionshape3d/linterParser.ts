/**
 * CollisionShape3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

validatorRegistry.registerAll('CollisionShape3D', {
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
});
