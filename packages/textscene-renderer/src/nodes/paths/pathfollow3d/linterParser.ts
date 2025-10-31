/**
 * PathFollow3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('PathFollow3D', {
  /**
   * Validate progress property
   * Must be a float >= 0 (negative values will be clamped by Godot)
   */
  'progress': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'progress' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROGRESS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate progress_ratio property
   * Must be a float (typically 0-1, but values outside range will be handled by semantic linter)
   */
  'progress_ratio': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'progress_ratio' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROGRESS_RATIO_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate h_offset property
   * Must be a float
   */
  'h_offset': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'h_offset' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_H_OFFSET_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate v_offset property
   * Must be a float
   */
  'v_offset': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'v_offset' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_V_OFFSET_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate rotation_mode property
   * Must be 0-4: NONE=0, Y=1, XY=2, XYZ=3, ORIENTED=4
   */
  'rotation_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'rotation_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 4) {
      return {
        severity: 'error',
        message: `Property 'rotation_mode' must be 0-4 (got ${num}). Valid values: 0=NONE, 1=Y, 2=XY, 3=XYZ, 4=ORIENTED`,
        line,
        column: key.length + 3,
        code: 'INVALID_ROTATION_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate cubic_interp property
   * Must be a boolean (true or false)
   */
  'cubic_interp': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'cubic_interp' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_CUBIC_INTERP_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate loop property
   * Must be a boolean (true or false)
   */
  'loop': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'loop' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LOOP_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate tilt_enabled property
   * Must be a boolean (true or false)
   */
  'tilt_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'tilt_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TILT_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate use_model_front property
   * Must be a boolean (true or false)
   */
  'use_model_front': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'use_model_front' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_USE_MODEL_FRONT_FORMAT',
      };
    }
    return null;
  },
});
