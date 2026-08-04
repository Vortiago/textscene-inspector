/**
 * GPUParticles3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `amount` keeps a bespoke validator because it has THREE branches
 * (format / non-positive / excessive). `visibility_aabb` similarly
 * validates AABB format AND positive size components in one shot.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v, makeFloatTupleRegex } from '../../../../linter/validators/index.js';
import { propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

// gpu_particles_3d.cpp:843 hints 4 labels ("Index,Lifetime,Reverse
// Lifetime,View Depth"); BIND_ENUM_CONSTANT binds all 4 (:857-860). The
// previous 3-label map both dropped REVERSE_LIFETIME and mislabelled index 2
// as VIEW_DEPTH (Godot's own index 2 is REVERSE_LIFETIME; VIEW_DEPTH is 3).
const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME', 2: 'REVERSE_LIFETIME', 3: 'VIEW_DEPTH' };

// Shared canonical float grammar (accepts .5 / 5. / +5 / scientific), matching
// v.aabb and the renderer.
const AABB_REGEX = makeFloatTupleRegex('AABB', 6);

const amountValidator: PropertyValidator = (key, value, line) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return propertyError(key, line, `Property 'amount' must be an integer, got: "${value}"`, 'INVALID_AMOUNT_FORMAT');
  }
  // gpu_particles_3d.cpp:76, ERR_FAIL_COND_MSG(p_amount < 1): the setter refuses.
  if (num < 1) {
    return propertyError(key, line, `Property 'amount' must be greater than 0 (got ${num}). Particles need a positive amount to render`, 'INVALID_AMOUNT_VALUE');
  }
  // The hint's ceiling (:821, "1,1000000,1,exp") is not enforced, so exceeding it
  // is the rule's `gpuparticles3d-performance` warning rather than an error here.
  return null;
};
// Tagged by hand (not built through `v`) so `boundGrounding.test.ts`'s sweep
// sees this bound too.
amountValidator.bounded = true;
amountValidator.grounding = { kind: 'enforced', cite: 'gpu_particles_3d.cpp:76' };

const visibilityAabbValidator: PropertyValidator = (key, value, line) => {
  if (!AABB_REGEX.test(value)) {
    return propertyError(key, line, `Property 'visibility_aabb' must be AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1), got: "${value}"`, 'INVALID_VISIBILITY_AABB_FORMAT');
  }

  const match = value.match(AABB_REGEX);
  if (match && match[4] && match[5] && match[6]) {
    const width = parseFloat(match[4]);
    const height = parseFloat(match[5]);
    const depth = parseFloat(match[6]);

    if (width <= 0 || height <= 0 || depth <= 0) {
      return propertyError(key, line, `Property 'visibility_aabb' size components must be positive (width=${width}, height=${height}, depth=${depth})`, 'INVALID_VISIBILITY_AABB_SIZE');
    }
  }

  return null;
};

validatorRegistry.registerAll('GPUParticles3D', {
  emitting: v.boolean('emitting'),
  amount: amountValidator,
  // gpu_particles_3d.cpp:81-84, ERR_FAIL_COND_MSG(p_lifetime <= 0, ...): the
  // setter refuses.
  lifetime: v.positiveFloat('lifetime', undefined, { enforced: 'gpu_particles_3d.cpp:82' }),
  one_shot: v.boolean('one_shot'),
  // gpu_particles_3d.cpp:828 hints "0.00,10.0,0.01,or_greater,exp";
  // set_pre_process_time:124-127 is a bare assignment.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'gpu_particles_3d.cpp:828' }),
  // gpu_particles_3d.cpp:829 hints "0,64,0.01" (closed both ends, 0 is legal);
  // set_speed_scale:174-177 is a bare assignment with no check at all — the
  // previous >0 bound rejected the hint-legal, unenforced value 0 (which
  // simply pauses particle time).
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'gpu_particles_3d.cpp:829' }),
  explosiveness: v.float('explosiveness', {
    min: 0,
    max: 1,
    hinted: 'gpu_particles_3d.cpp:830',
  }),
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'gpu_particles_3d.cpp:831' }),
  // gpu_particles_3d.cpp:834 hints "0,1000,1,suffix:FPS" (closed, ceiling
  // 1000, not the previous 120); set_fixed_fps:309-312 is a bare assignment.
  fixed_fps: v.int('fixed_fps', {
    min: 0,
    max: 1000,
    message:
      "Property 'fixed_fps' must be between 0 and 1000. Valid range: 0=automatic, 1-1000=fixed simulation rate",
    hinted: 'gpu_particles_3d.cpp:834',
  }),
  fract_delta: v.boolean('fract_delta'),
  process_material: v.resourceReference('process_material'),
  draw_pass_1: v.resourceReference('draw_pass_1'),
  visibility_aabb: visibilityAabbValidator,
  local_coords: v.boolean('local_coords'),
  // gpu_particles_3d.cpp:236-239, set_draw_order is a bare assignment.
  draw_order: v.enumInt('draw_order', 0, 3, DRAW_ORDER, { hinted: 'gpu_particles_3d.cpp:843' }),
  trail_enabled: v.boolean('trail_enabled'),
  // gpu_particles_3d.cpp:247-250, ERR_FAIL_COND(p_seconds < 0.01 -
  // CMP_EPSILON): the real enforced floor is 0.01, not the ~0 `positiveFloat`
  // previously used here.
  trail_lifetime: v.float('trail_lifetime', {
    min: 0.01,
    enforced: 'gpu_particles_3d.cpp:248',
  }),
  // gpu_particles_3d.cpp:839 hints "0,128,0.01,or_greater" (0 is legal, means
  // no collision radius); set_collision_base_size:179-182 is a bare
  // assignment with no check at all — the previous >0 bound rejected the
  // hint-legal, unenforced value 0.
  collision_base_size: v.nonNegativeFloat('collision_base_size', {
    hinted: 'gpu_particles_3d.cpp:839',
  }),
  sub_emitter: v.nodePath('sub_emitter'),
  // gpu_particles_3d.cpp:87-90, `interp_to_end_factor = CLAMP(p_interp, 0.0,
  // 1.0)`: both ends enforced.
  interp_to_end: v.float('interp_to_end', {
    min: 0,
    max: 1,
    enforced: 'gpu_particles_3d.cpp:88',
  }),
});

// Shown in the generated `## Linting` table of this node's sheet.
amountValidator.accepts = 'integer > 0';
visibilityAabbValidator.accepts = 'AABB(12 floats)';
