/**
 * GPUParticlesCollisionSphere3D strict validators for linting.
 *
 * Declare only GPUParticlesCollisionSphere3D's OWN members — the ones doc/classes/GPUParticlesCollisionSphere3D.xml
 * lists without an `overrides=` attribute. Everything from GPUParticlesCollision3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesCollisionSphere3D', {
  // gpu_particles_collision_3d.cpp:71, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` with no matching
  // `or_less` means the lower bound (0.01) is hard and the upper bound (1024)
  // is only the editor slider's soft extent, so it is not capped here.
  radius: v.float('radius', { min: 0.01 }),
});
