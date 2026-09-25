/**
 * GPUParticlesAttractorSphere3D strict validators for linting: only its own members, the ones
 * doc/classes/GPUParticlesAttractorSphere3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from GPUParticlesAttractor3D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractorSphere3D', {
  // gpu_particles_collision_3d.cpp:922, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` makes 1024 a soft
  // slider bound only, so no upper cap. `or_less` is absent, so 0.01 is the
  // hint's floor. set_radius:925-929 is a bare assignment, so it is a warning.
  radius: v.float('radius', { min: 0.01, hinted: 'gpu_particles_collision_3d.cpp:922' }),
});
