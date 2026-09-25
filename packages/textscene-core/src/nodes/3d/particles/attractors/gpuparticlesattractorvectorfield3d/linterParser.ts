/**
 * GPUParticlesAttractorVectorField3D strict validators for linting: only its own members, the ones
 * doc/classes/GPUParticlesAttractorVectorField3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from GPUParticlesAttractor3D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractorVectorField3D', {
  // gpu_particles_collision_3d.cpp:1003, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` softens only the stated
  // max, so 1024 is not a cap; the min carries no `or_less`, so 0.01 is the
  // hint's floor. set_size:1025-1029 is a bare assignment, so it is a warning.
  size: v.boundedVector3('size', { min: 0.01, hinted: 'gpu_particles_collision_3d.cpp:1003' }),
  // :1004, PROPERTY_HINT_RESOURCE_TYPE "Texture3D": a resource reference, not a
  // numeric hint, so the check is format-only.
  texture: v.resourceReference('texture'),
});
