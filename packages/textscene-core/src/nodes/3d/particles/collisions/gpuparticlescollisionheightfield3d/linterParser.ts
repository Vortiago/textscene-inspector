/**
 * GPUParticlesCollisionHeightField3D strict validators for linting.
 *
 * Declare only GPUParticlesCollisionHeightField3D's OWN members: the ones doc/classes/GPUParticlesCollisionHeightField3D.xml
 * lists without an `overrides=` attribute. Everything from GPUParticlesCollision3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { v, layerBitmask } from '../../../../../linter/validators/index.js';

/** gpu_particles_collision_3d.cpp:734 ADD_PROPERTY, PROPERTY_HINT_ENUM "256 (Fastest),512 (Fast),1024 (Average),2048 (Slow),4096 (Slower),8192 (Slowest)". */
const RESOLUTION = {
  0: '256',
  1: '512',
  2: '1024',
  3: '2048',
  4: '4096',
  5: '8192',
};

/** gpu_particles_collision_3d.cpp:735 ADD_PROPERTY, PROPERTY_HINT_ENUM "When Moved (Fast),Always (Slow)". */
const UPDATE_MODE = {
  0: 'WHEN_MOVED',
  1: 'ALWAYS',
};

validatorRegistry.registerAll('GPUParticlesCollisionHeightField3D', {
  // gpu_particles_collision_3d.cpp:733, PROPERTY_HINT_RANGE
  // "0.01,1024,0.01,or_greater,suffix:m": `or_greater` softens only the stated
  // max, so 1024 is not a cap; the min carries no `or_less`, so 0.01 is the
  // hint's floor. set_size:769-774 is a bare assignment, so it is a warning.
  size: v.boundedVector3('size', { min: 0.01, hinted: 'gpu_particles_collision_3d.cpp:733' }),
  // gpu_particles_collision_3d.cpp:734, PROPERTY_HINT_ENUM with 6 comma-separated
  // entries: the .tscn stores the 0-based INDEX into that list (RESOLUTION_256=0
  // through RESOLUTION_8192=5, gpu_particles_collision_3d.cpp:739-744 /
  // BIND_ENUM_CONSTANT), never the literal resolution value. set_resolution:780-785
  // is a bare assignment.
  resolution: v.enumInt('resolution', 0, 5, RESOLUTION, {
    hinted: 'gpu_particles_collision_3d.cpp:734',
  }),
  // gpu_particles_collision_3d.cpp:735, PROPERTY_HINT_ENUM with 2 entries:
  // UPDATE_MODE_WHEN_MOVED=0, UPDATE_MODE_ALWAYS=1 (gpu_particles_collision_3d.cpp:747-748).
  // set_update_mode:791-794 is a bare assignment.
  update_mode: v.enumInt('update_mode', 0, 1, UPDATE_MODE, {
    hinted: 'gpu_particles_collision_3d.cpp:735',
  }),
  // gpu_particles_collision_3d.cpp:736, plain BOOL with no hint.
  follow_camera_enabled: v.boolean('follow_camera_enabled'),
  // gpu_particles_collision_3d.cpp:737, PROPERTY_HINT_LAYERS_3D_RENDER: same
  // 32-bit render-layer mask shape as the base class's cull_mask.
  heightfield_mask: layerBitmask('heightfield_mask', { hinted: 'gpu_particles_collision_3d.cpp:737', width: 'uint32' /* gpu_particles_collision_3d.h:252 */ }),
});
