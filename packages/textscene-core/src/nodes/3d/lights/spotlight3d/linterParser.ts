/** SpotLight3D strict validators for linting. */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { sharedLightValidators } from '../shared/linterParser.js';

validatorRegistry.registerAll('SpotLight3D', {
  ...sharedLightValidators,

  /**
   * Validate spot_range property
   * Must be a float > 0 (REQUIRED for SpotLight3D to function)
   */
  'spot_range': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'spot_range' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_RANGE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'spot_range' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_RANGE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate spot_attenuation property
   * Must be a float >= 0
   */
  'spot_attenuation': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'spot_attenuation' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_ATTENUATION_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'spot_attenuation' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_ATTENUATION_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate spot_angle property
   * Must be a float 0-90 (REQUIRED for SpotLight3D to function)
   */
  'spot_angle': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'spot_angle' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_ANGLE_FORMAT',
      };
    }
    if (num < 0 || num > 90) {
      return {
        severity: 'error',
        message: `Property 'spot_angle' must be between 0 and 90 degrees (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_ANGLE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate spot_angle_attenuation property
   * Must be a float >= 0
   */
  'spot_angle_attenuation': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'spot_angle_attenuation' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_ANGLE_ATTENUATION_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'spot_angle_attenuation' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPOT_ANGLE_ATTENUATION_VALUE',
      };
    }
    return null;
  },
});
