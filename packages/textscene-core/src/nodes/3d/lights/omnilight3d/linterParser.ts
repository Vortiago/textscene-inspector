/** OmniLight3D strict validators for linting. */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { sharedLightValidators } from '../shared/linterParser.js';

validatorRegistry.registerAll('OmniLight3D', {
  ...sharedLightValidators,

  /**
   * Validate omni_range property
   * Must be a float > 0 (REQUIRED for OmniLight3D to function)
   */
  'omni_range': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'omni_range' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OMNI_RANGE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'omni_range' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_OMNI_RANGE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate omni_attenuation property
   * Must be a float >= 0
   */
  'omni_attenuation': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'omni_attenuation' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OMNI_ATTENUATION_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'omni_attenuation' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_OMNI_ATTENUATION_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate omni_shadow_mode property
   * Must be 0-1: DUAL_PARABOLOID=0, CUBE=1
   */
  'omni_shadow_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'omni_shadow_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_OMNI_SHADOW_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'omni_shadow_mode' must be 0-1 (got ${num}). Valid values: 0=DUAL_PARABOLOID, 1=CUBE`,
        line,
        column: key.length + 3,
        code: 'INVALID_OMNI_SHADOW_MODE_VALUE',
      };
    }
    return null;
  },
});
