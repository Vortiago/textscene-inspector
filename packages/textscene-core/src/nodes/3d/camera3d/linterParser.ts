/**
 * Camera3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

const PROJECTION = { 0: 'PERSPECTIVE', 1: 'ORTHOGONAL', 2: 'FRUSTUM' };
const KEEP_ASPECT = { 0: 'KEEP_WIDTH', 1: 'KEEP_HEIGHT', 2: 'KEEP_ASPECT_DISABLED' };
const DOPPLER_TRACKING = { 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' };

validatorRegistry.registerAll('Camera3D', {
  projection: v.enumInt('projection', 0, 2, PROJECTION),
  // camera_3d.cpp:725, ERR_FAIL_COND(p_fov < 1 || p_fov > 179): the setter
  // refuses, so this is an error rather than an advisory. Custom message keeps
  // the "degrees" qualifier that the per-node test asserts.
  fov: v.float('fov', {
    min: 1,
    max: 179,
    message: "Property 'fov' must be between 1 and 179 degrees",
  }),
  // camera_3d.cpp:731, ERR_FAIL_COND(p_size <= CMP_EPSILON).
  size: v.positiveFloat('size'),
  frustum_offset: v.vector2('frustum_offset'),
  // set_near:736 / set_far:746 are bare assignments; their hints (:685/:686)
  // are advisory, so the low ends are warnings in linter.ts, not errors.
  near: v.float('near'),
  far: v.float('far'),
  keep_aspect: v.enumInt('keep_aspect', 0, 2, KEEP_ASPECT),
  cull_mask: layerBitmask('cull_mask'),
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING),
  current: v.boolean('current'),
  h_offset: v.float('h_offset'),
  v_offset: v.float('v_offset'),
});
