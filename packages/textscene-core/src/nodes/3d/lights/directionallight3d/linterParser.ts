/**
 * DirectionalLight3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Color format: Color(r, g, b, a) - four comma-separated floats (0-1 range typically)
const COLOR_REGEX = /^Color\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

validatorRegistry.registerAll('DirectionalLight3D', {
  /**
   * Validate light_energy property
   * Must be a float > 0
   */
  'light_energy': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'light_energy' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_ENERGY_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'light_energy' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_ENERGY_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate light_color property
   * Must be Color(r, g, b, a)
   */
  'light_color': (key, value, line) => {
    if (!COLOR_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'light_color' must be Color with 4 numbers like Color(1, 1, 1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_COLOR_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate light_indirect_energy property
   * Must be a float >= 0
   */
  'light_indirect_energy': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'light_indirect_energy' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_INDIRECT_ENERGY_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'light_indirect_energy' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_INDIRECT_ENERGY_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate light_volumetric_fog_energy property
   * Must be a float >= 0
   */
  'light_volumetric_fog_energy': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'light_volumetric_fog_energy' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_VOLUMETRIC_FOG_ENERGY_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'light_volumetric_fog_energy' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_VOLUMETRIC_FOG_ENERGY_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate shadow_enabled property
   * Must be a boolean (true or false)
   */
  'shadow_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'shadow_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate shadow_bias property
   * Must be a float (typically 0.01-1)
   */
  'shadow_bias': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'shadow_bias' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_BIAS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate shadow_normal_bias property
   * Must be a float (typically 0-4)
   */
  'shadow_normal_bias': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'shadow_normal_bias' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_NORMAL_BIAS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate shadow_blur property
   * Must be a float >= 0
   */
  'shadow_blur': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'shadow_blur' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_BLUR_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'shadow_blur' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_BLUR_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate shadow_transmittance_bias property
   * Must be a float in range -10 to 10
   */
  'shadow_transmittance_bias': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'shadow_transmittance_bias' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_TRANSMITTANCE_BIAS_FORMAT',
      };
    }
    if (num < -10 || num > 10) {
      return {
        severity: 'error',
        message: `Property 'shadow_transmittance_bias' must be between -10 and 10 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_TRANSMITTANCE_BIAS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate shadow_opacity property
   * Must be a float in range 0-1
   */
  'shadow_opacity': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'shadow_opacity' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_OPACITY_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'shadow_opacity' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_OPACITY_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate shadow_reverse_cull_face property
   * Must be a boolean (true or false)
   */
  'shadow_reverse_cull_face': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'shadow_reverse_cull_face' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SHADOW_REVERSE_CULL_FACE_FORMAT',
      };
    }
    return null;
  },

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
   * Validate light_negative property
   * Must be a boolean (true or false)
   */
  'light_negative': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'light_negative' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_NEGATIVE_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate light_specular property
   * Must be a float in range 0-1
   */
  'light_specular': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'light_specular' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_SPECULAR_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'light_specular' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_SPECULAR_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate light_bake_mode property
   * Must be 0-2: DISABLED=0, STATIC=1, DYNAMIC=2
   */
  'light_bake_mode': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'light_bake_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_BAKE_MODE_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'light_bake_mode' must be 0-2 (got ${num}). Valid values: 0=DISABLED, 1=STATIC, 2=DYNAMIC`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_BAKE_MODE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate light_cull_mask property
   * Must be a valid bitmask (1-1048575 for bits 1-20)
   */
  'light_cull_mask': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'light_cull_mask' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_CULL_MASK_FORMAT',
      };
    }
    if (num < 1 || num > 1048575) {
      return {
        severity: 'error',
        message: `Property 'light_cull_mask' must be between 1 and 1048575 (got ${num}). Valid range: bits 1-20`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIGHT_CULL_MASK_VALUE',
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
