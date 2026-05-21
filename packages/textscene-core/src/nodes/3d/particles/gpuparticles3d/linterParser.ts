/**
 * GPUParticles3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 *
 * `amount` keeps a bespoke validator because it has THREE branches
 * (format / non-positive / excessive). `visibility_aabb` similarly
 * validates AABB format AND positive size components in one shot.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME', 2: 'VIEW_DEPTH' };
const MAX_RECOMMENDED_PARTICLES = 100000;

const AABB_REGEX =
  /^AABB\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

const amountValidator: PropertyValidator = (key, value, line) => {
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
};

const visibilityAabbValidator: PropertyValidator = (key, value, line) => {
  if (!AABB_REGEX.test(value)) {
    return {
      severity: 'error',
      message: `Property 'visibility_aabb' must be AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1), got: "${value}"`,
      line,
      column: key.length + 3,
      code: 'INVALID_VISIBILITY_AABB_FORMAT',
    };
  }

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
};

validatorRegistry.registerAll('GPUParticles3D', {
  emitting: v.boolean('emitting'),
  amount: amountValidator,
  lifetime: v.positiveFloat('lifetime'),
  one_shot: v.boolean('one_shot'),
  preprocess: v.nonNegativeFloat('preprocess'),
  speed_scale: v.float('speed_scale', {
    min: Number.MIN_VALUE,
    message:
      "Property 'speed_scale' must be greater than 0. Zero or negative values stop particle time",
  }),
  explosiveness: v.float('explosiveness', { min: 0, max: 1 }),
  randomness: v.float('randomness', { min: 0, max: 1 }),
  fixed_fps: v.int('fixed_fps', {
    min: 0,
    max: 120,
    message:
      "Property 'fixed_fps' must be between 0 and 120. Valid range: 0=automatic, 1-120=fixed simulation rate",
  }),
  fract_delta: v.boolean('fract_delta'),
  process_material: v.resourceReference('process_material'),
  draw_pass_1: v.resourceReference('draw_pass_1'),
  visibility_aabb: visibilityAabbValidator,
  local_coords: v.boolean('local_coords'),
  draw_order: v.enumInt('draw_order', 0, 2, DRAW_ORDER),
  trail_enabled: v.boolean('trail_enabled'),
  trail_lifetime: v.positiveFloat('trail_lifetime'),
  collision_base_size: v.positiveFloat('collision_base_size'),
  sub_emitter: v.nodePath('sub_emitter'),
  interp_to_end: v.float('interp_to_end', { min: 0, max: 1 }),
});
