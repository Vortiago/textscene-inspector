/** DirectionalLight3D strict validators for linting. */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { sharedLightValidators } from '../shared/linterParser.js';

validatorRegistry.registerAll('DirectionalLight3D', {
  ...sharedLightValidators,

  /**
   * Validate directional_shadow_mode property
   * Must be 0-2: ORTHOGONAL=0, PARALLEL_2_SPLITS=1, PARALLEL_4_SPLITS=2
   */
  'directional_shadow_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_mode' must be 0-2 (got ${num}). Valid values: 0=ORTHOGONAL, 1=PARALLEL_2_SPLITS, 2=PARALLEL_4_SPLITS`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_split_1 property
   * Must be a float in range 0-1
   */
  'directional_shadow_split_1': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_split_1' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_SPLIT_1_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_split_1' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_SPLIT_1_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_split_2 property
   * Must be a float in range 0-1
   */
  'directional_shadow_split_2': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_split_2' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_SPLIT_2_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_split_2' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_SPLIT_2_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_split_3 property
   * Must be a float in range 0-1
   */
  'directional_shadow_split_3': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_split_3' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_SPLIT_3_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_split_3' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_SPLIT_3_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_fade_start property
   * Must be a float in range 0-1
   */
  'directional_shadow_fade_start': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_fade_start' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_FADE_START_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_fade_start' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_FADE_START_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_max_distance property
   * Must be a float >= 0
   */
  'directional_shadow_max_distance': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_max_distance' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_MAX_DISTANCE_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_max_distance' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_MAX_DISTANCE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_pancake_size property
   * Must be a float >= 0
   */
  'directional_shadow_pancake_size': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_pancake_size' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_PANCAKE_SIZE_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_pancake_size' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_PANCAKE_SIZE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate directional_shadow_blend_splits property
   * Must be a boolean (true or false)
   */
  'directional_shadow_blend_splits': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'directional_shadow_blend_splits' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DIRECTIONAL_SHADOW_BLEND_SPLITS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate sky_mode property
   * Must be 0-2: LIGHT_AND_SKY=0, LIGHT_ONLY=1, SKY_ONLY=2
   */
  'sky_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'sky_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SKY_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'sky_mode' must be 0-2 (got ${num}). Valid values: 0=LIGHT_AND_SKY, 1=LIGHT_ONLY, 2=SKY_ONLY`,
        line,
        column: key.length + 3,
        code: 'INVALID_SKY_MODE_VALUE',
      };
    }
    return null;
  },
});
