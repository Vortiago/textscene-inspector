/**
 * GPUParticlesAttractorSphere3D strict validators for linting.
 *
 * Declare only GPUParticlesAttractorSphere3D's OWN members — the ones doc/classes/GPUParticlesAttractorSphere3D.xml
 * lists without an `overrides=` attribute. Everything from GPUParticlesAttractor3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractorSphere3D', {
  // gpu_particles_collision_3d.cpp:922, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` makes 1024 a soft
  // slider bound only, so no upper cap. `or_less` is absent, so the stated
  // 0.01 floor IS the hard bound.
  radius: v.float('radius', { min: 0.01 }),
});
