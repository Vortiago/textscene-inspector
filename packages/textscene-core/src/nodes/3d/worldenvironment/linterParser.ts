/**
 * WorldEnvironment strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

validatorRegistry.registerAll('WorldEnvironment', {
  /**
   * Validate environment resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'environment': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'environment' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ENVIRONMENT_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate camera_attributes resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'camera_attributes': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'camera_attributes' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CAMERA_ATTRIBUTES_REFERENCE',
      };
    }
    return null;
  },
});
