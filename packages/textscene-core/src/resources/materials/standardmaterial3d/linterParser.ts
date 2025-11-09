/**
 * Strict parser validation for StandardMaterial3D SubResource properties.
 * Validates format and basic constraints during parse time.
 *
 * Note: Full semantic validation (e.g., checking normal_enabled=true requires normal_texture)
 * would require extending the linter to validate SubResources, not just nodes.
 * For now, we validate basic format constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * Validate boolean properties (normal_enabled, etc.)
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

/**
 * Validate ExtResource reference format
 */
const validateExtResource: PropertyValidator = (key, value, line) => {
  const extResourcePattern = /^ExtResource\("([^"]+)"\)$/;
  if (!extResourcePattern.test(value)) {
    return {
      severity: 'error',
      message: `Property "${key}" must be an ExtResource reference like ExtResource("1_abc"), got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_EXTRESOURCE',
    };
  }
  return null;
};

// Register validators for StandardMaterial3D properties
validatorRegistry.registerAll('StandardMaterial3D', {
  normal_enabled: validateBoolean,
  emission_enabled: validateBoolean,
  normal_texture: validateExtResource,
  albedo_texture: validateExtResource,
  metallic_texture: validateExtResource,
  roughness_texture: validateExtResource,
  ao_texture: validateExtResource,
  emission_texture: validateExtResource,
});
