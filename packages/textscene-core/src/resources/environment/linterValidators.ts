/**
 * Environment linter validators - validates property formats and constraints
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry';
import type { PropertyValidator } from '../../linter/ValidatorRegistry';
import { COLOR_RE } from '../../parser/vectors.js';

/**
 * Validate boolean properties
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
 * Validate Color format: Color(r, g, b, a)
 */
const validateColor: PropertyValidator = (key, value, line) => {
  if (!COLOR_RE.test(value)) {
    return {
      severity: 'error',
      message: `Property "${key}" must be a Color in format Color(r, g, b, a), got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_COLOR_FORMAT',
    };
  }
  return null;
};

/**
 * Validate number >= 0
 */
const validateNonNegativeNumber = (): PropertyValidator => {
  return (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return {
        severity: 'error',
        message: `Property "${key}" must be a number >= 0, got: "${value}"`,
        line,
        column: 0,
        code: 'INVALID_NUMBER',
      };
    }
    return null;
  };
};

/**
 * Validate background_mode enum (0-5)
 */
const validateBackgroundMode: PropertyValidator = (_key, value, line) => {
  const mode = parseInt(value, 10);
  if (isNaN(mode) || mode < 0 || mode > 5) {
    return {
      severity: 'error',
      message: `Property 'background_mode' must be an integer 0-5, got: "${value}"`,
      line,
      column: 0,
      code: 'INVALID_BACKGROUND_MODE',
    };
  }
  return null;
};

// Register validators for Environment properties
validatorRegistry.registerAll('Environment', {
  background_mode: validateBackgroundMode,
  background_color: validateColor,
  background_energy_multiplier: validateNonNegativeNumber(),

  volumetric_fog_enabled: validateBoolean,
  volumetric_fog_density: validateNonNegativeNumber(),
  volumetric_fog_albedo: validateColor,
  volumetric_fog_emission: validateColor,

  adjustment_enabled: validateBoolean,
  adjustment_brightness: validateNonNegativeNumber(),
  adjustment_contrast: validateNonNegativeNumber(),
  adjustment_saturation: validateNonNegativeNumber(),

  ssr_enabled: validateBoolean,
});

// Export validators for reuse
export { validateBoolean, validateColor };
