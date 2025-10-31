/**
 * GPUParticles3D strict validators for linting
 *
 * Registers property validators that check format and value constraints.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Resource reference format: SubResource("id") or ExtResource("id")
const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

// NodePath format: NodePath("path") or NodePath("")
const NODE_PATH_REGEX = /^NodePath\(".*"\)$/;

// AABB format: AABB(x, y, z, width, height, depth) - 6 floats
const AABB_REGEX = /^AABB\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

// Performance thresholds
const MAX_RECOMMENDED_PARTICLES = 100000;

validatorRegistry.registerAll('GPUParticles3D', {
  /**
   * Validate emitting property
   * Must be a boolean value (true or false)
   */
  'emitting': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'emitting' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EMITTING_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate amount property (REQUIRED - number of particles)
   * Must be an integer greater than 0
   */
  'amount': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'amount' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_AMOUNT_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'amount' must be greater than 0 (got ${num}). Particles need a positive amount to render`,
        line,
        column: key.length + 3,
        code: 'INVALID_AMOUNT_VALUE',
      };
    }
    if (num > MAX_RECOMMENDED_PARTICLES) {
      return {
        severity: 'error',
        message: `Property 'amount' is ${num}, which exceeds recommended maximum of ${MAX_RECOMMENDED_PARTICLES}. This may cause severe performance issues`,
        line,
        column: key.length + 3,
        code: 'EXCESSIVE_AMOUNT_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate lifetime property (REQUIRED - particle lifespan)
   * Must be a float greater than 0
   */
  'lifetime': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'lifetime' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIFETIME_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'lifetime' must be greater than 0 (got ${num}). Particles need a positive lifespan`,
        line,
        column: key.length + 3,
        code: 'INVALID_LIFETIME_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate one_shot property
   * Must be a boolean value (true or false)
   */
  'one_shot': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'one_shot' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_ONE_SHOT_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate preprocess property
   * Must be a non-negative float (seconds to pre-simulate)
   */
  'preprocess': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'preprocess' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PREPROCESS_FORMAT',
      };
    }
    if (num < 0) {
      return {
        severity: 'error',
        message: `Property 'preprocess' must be non-negative (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_PREPROCESS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate speed_scale property (REQUIRED - time multiplier)
   * Must be a float greater than 0
   */
  'speed_scale': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'speed_scale' must be greater than 0 (got ${num}). Zero or negative values stop particle time`,
        line,
        column: key.length + 3,
        code: 'INVALID_SPEED_SCALE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate explosiveness property
   * Must be a float between 0 and 1 (0=continuous, 1=all at once)
   */
  'explosiveness': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'explosiveness' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_EXPLOSIVENESS_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'explosiveness' must be between 0 and 1 (got ${num}). Valid range: 0=continuous emission, 1=all particles at once`,
        line,
        column: key.length + 3,
        code: 'INVALID_EXPLOSIVENESS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate randomness property
   * Must be a float between 0 and 1
   */
  'randomness': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'randomness' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_RANDOMNESS_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'randomness' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_RANDOMNESS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate fixed_fps property
   * Must be an integer between 0 and 120 (0=automatic)
   */
  'fixed_fps': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'fixed_fps' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FIXED_FPS_FORMAT',
      };
    }
    if (num < 0 || num > 120) {
      return {
        severity: 'error',
        message: `Property 'fixed_fps' must be between 0 and 120 (got ${num}). Valid range: 0=automatic, 1-120=fixed simulation rate`,
        line,
        column: key.length + 3,
        code: 'INVALID_FIXED_FPS_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate fract_delta property
   * Must be a boolean value (true or false)
   */
  'fract_delta': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'fract_delta' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_FRACT_DELTA_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate process_material resource reference (REQUIRED)
   * Must be SubResource("id") or ExtResource("id")
   */
  'process_material': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'process_material' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_PROCESS_MATERIAL_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate draw_pass_1 mesh resource reference
   * Must be SubResource("id") or ExtResource("id")
   */
  'draw_pass_1': (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'draw_pass_1' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAW_PASS_REFERENCE',
      };
    }
    return null;
  },

  /**
   * Validate visibility_aabb property
   * Must be AABB(x, y, z, width, height, depth)
   */
  'visibility_aabb': (key, value, line) => {
    if (!AABB_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'visibility_aabb' must be AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_VISIBILITY_AABB_FORMAT',
      };
    }

    // Validate size components are positive
    const match = value.match(AABB_REGEX);
    if (match && match[4] && match[5] && match[6]) {
      const width = parseFloat(match[4]);
      const height = parseFloat(match[5]);
      const depth = parseFloat(match[6]);

      if (width <= 0 || height <= 0 || depth <= 0) {
        return {
          severity: 'error',
          message: `Property 'visibility_aabb' size components must be positive (width=${width}, height=${height}, depth=${depth})`,
          line,
          column: key.length + 3,
          code: 'INVALID_VISIBILITY_AABB_SIZE',
        };
      }
    }

    return null;
  },

  /**
   * Validate local_coords property
   * Must be a boolean value (true or false)
   */
  'local_coords': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'local_coords' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_LOCAL_COORDS_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate draw_order property
   * Must be an integer from 0-2:
   * 0 = INDEX, 1 = LIFETIME, 2 = VIEW_DEPTH
   */
  'draw_order': (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'draw_order' must be an integer, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAW_ORDER_FORMAT',
      };
    }
    if (num < 0 || num > 2) {
      return {
        severity: 'error',
        message: `Property 'draw_order' must be 0-2 (got ${num}). Valid values: 0=INDEX, 1=LIFETIME, 2=VIEW_DEPTH`,
        line,
        column: key.length + 3,
        code: 'INVALID_DRAW_ORDER_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate trail_enabled property
   * Must be a boolean value (true or false)
   */
  'trail_enabled': (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property 'trail_enabled' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRAIL_ENABLED_FORMAT',
      };
    }
    return null;
  },

  /**
   * Validate trail_lifetime property
   * Must be a float greater than 0
   */
  'trail_lifetime': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'trail_lifetime' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRAIL_LIFETIME_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'trail_lifetime' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_TRAIL_LIFETIME_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate collision_base_size property
   * Must be a float greater than 0
   */
  'collision_base_size': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'collision_base_size' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_BASE_SIZE_FORMAT',
      };
    }
    if (num <= 0) {
      return {
        severity: 'error',
        message: `Property 'collision_base_size' must be greater than 0 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_COLLISION_BASE_SIZE_VALUE',
      };
    }
    return null;
  },

  /**
   * Validate sub_emitter NodePath
   * Must be a valid NodePath (starts with NodePath("..."))
   */
  'sub_emitter': (key, value, line) => {
    if (!NODE_PATH_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property 'sub_emitter' must be a NodePath like NodePath("path/to/emitter"), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_SUB_EMITTER_PATH',
      };
    }
    return null;
  },

  /**
   * Validate interp_to_end property
   * Must be a float between 0 and 1
   */
  'interp_to_end': (key, value, line) => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'interp_to_end' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_INTERP_TO_END_FORMAT',
      };
    }
    if (num < 0 || num > 1) {
      return {
        severity: 'error',
        message: `Property 'interp_to_end' must be between 0 and 1 (got ${num})`,
        line,
        column: key.length + 3,
        code: 'INVALID_INTERP_TO_END_VALUE',
      };
    }
    return null;
  },
});
