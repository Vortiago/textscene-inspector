/**
 * Validators shared by every GPUParticlesAttractor3D-derived node.
 *
 * Registered under the abstract key 'GPUParticlesAttractor3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * 3 subclasses through the
 * NODE_BASE_TYPES base-walk.
 *
 * Declare only GPUParticlesAttractor3D's OWN members: the ones doc/classes/GPUParticlesAttractor3D.xml
 * lists without an `overrides=` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 */

import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractor3D', {
  // gpu_particles_collision_3d.cpp:900, PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_greater,or_less": both ends soft, so no bound. A negative
  // strength repels rather than attracts.
  strength: v.float('strength'),
  // :901, PROPERTY_HINT_EXP_EASING. An easing-curve editor carries no range.
  attenuation: v.nonNegativeFloat('attenuation'),
  // :902, PROPERTY_HINT_RANGE "0,1,0.01", no or_greater: a hard 0-1.
  directionality: v.float('directionality', { min: 0, max: 1 }),
  // :903, PROPERTY_HINT_LAYERS_3D_RENDER.
  cull_mask: layerBitmask('cull_mask'),
});
