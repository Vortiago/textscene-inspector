/**
 * GPUParticlesAttractorBox3D strict validators for linting.
 *
 * Declare only GPUParticlesAttractorBox3D's OWN members — the ones
 * doc/classes/GPUParticlesAttractorBox3D.xml lists without an `overrides=`
 * attribute. Everything from GPUParticlesAttractor3D up is registered on the
 * ancestor and delivered by the NODE_BASE_TYPES base-walk, so re-declaring an
 * inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractorBox3D', {
  // gpu_particles_collision_3d.cpp:952, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` softens only the stated
  // max, so 1024 is not a cap; the min carries no `or_less`, so 0.01 is the
  // hint's floor. set_size:973-977 is a bare assignment, so it is a warning.
  size: v.boundedVector3('size', { min: 0.01, hinted: 'gpu_particles_collision_3d.cpp:952' }),
});
