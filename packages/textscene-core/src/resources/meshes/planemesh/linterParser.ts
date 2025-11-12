/**
 * Strict parser validation for PlaneMesh SubResource properties.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * Validate boolean properties (flip_faces)
 */
const validateBoolean: PropertyValidator = (key, value, line) => {
  if (value !== 'true' && value !== 'false') {
    return {
      severity: 'error',
      message: `Property "${key}" must be "true" or "false", got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_BOOLEAN',
    };
  }
  return null;
};

// Register validators for PlaneMesh properties
validatorRegistry.registerAll('PlaneMesh', {
  flip_faces: validateBoolean,
});
