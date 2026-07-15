/**
 * Camera3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const PROJECTION = { 0: 'PERSPECTIVE', 1: 'ORTHOGONAL', 2: 'FRUSTUM' };
const KEEP_ASPECT = { 0: 'KEEP_WIDTH', 1: 'KEEP_HEIGHT', 2: 'KEEP_ASPECT_DISABLED' };
const DOPPLER_TRACKING = { 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' };

validatorRegistry.registerAll('Camera3D', {
  projection: v.enumInt('projection', 0, 2, PROJECTION),
  // Custom message keeps the "degrees" qualifier that the per-node test asserts.
  fov: v.float('fov', {
    min: 1,
    max: 179,
    message: "Property 'fov' must be between 1 and 179 degrees",
  }),
  size: v.positiveFloat('size'),
  frustum_offset: v.vector2('frustum_offset'),
  near: v.positiveFloat('near'),
  far: v.positiveFloat('far'),
  keep_aspect: v.enumInt('keep_aspect', 0, 2, KEEP_ASPECT),
  cull_mask: v.int('cull_mask', {
    min: 1,
    max: 1048575,
    message:
      "Property 'cull_mask' must be between 1 and 1048575. Valid range: bits 1-20",
  }),
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING),
  current: v.boolean('current'),
  h_offset: v.float('h_offset'),
  v_offset: v.float('v_offset'),
});
