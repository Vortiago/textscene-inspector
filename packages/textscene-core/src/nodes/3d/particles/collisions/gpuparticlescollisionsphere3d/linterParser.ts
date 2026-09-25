/**
 * GPUParticlesCollisionSphere3D strict validators for linting: only its own members, the ones
 * doc/classes/GPUParticlesCollisionSphere3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from GPUParticlesCollision3D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesCollisionSphere3D', {
  // gpu_particles_collision_3d.cpp:71, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": 0.01 is the hint's floor and 1024 only a
  // slider extent. set_radius:74-78 is a bare assignment, so it warns.
  radius: v.float('radius', { min: 0.01, hinted: 'gpu_particles_collision_3d.cpp:71' }),
});
