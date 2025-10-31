/**
 * Path3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

validatorRegistry.registerAll('Path3D', {
  /**
   * Validate curve resource reference (REQUIRED property)
   * Must be SubResource("id") or ExtResource("id")
   */
  'curve': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'curve' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CURVE_REFERENCE',
      };
    }
    return null;
  },
});
