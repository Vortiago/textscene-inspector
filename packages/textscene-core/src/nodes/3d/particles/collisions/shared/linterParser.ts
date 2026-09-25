/**
 * Validators shared by every GPUParticlesCollision3D-derived node, under the abstract key
 * 'GPUParticlesCollision3D', which appears in no .tscn. The NODE_BASE_TYPES base-walk
 * delivers them. Only its own members: doc/classes/GPUParticlesCollision3D.xml
 * without `overrides=`, checked against ADD_PROPERTY.
 */

// Registration happens on import, so a test that loads only this slice resolves an
// inherited key only when this line pulls the ancestor in.
import '../../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesCollision3D', {
  // gpu_particles_collision_3d.cpp:51, PROPERTY_HINT_LAYERS_3D_RENDER. The only
  // member the base binds; every shape property belongs to a leaf.
  cull_mask: layerBitmask('cull_mask', { hinted: 'gpu_particles_collision_3d.cpp:51', width: 'uint32' /* gpu_particles_collision_3d.h:49 */ }),
});
