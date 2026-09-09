/**
 * Validators shared by every GPUParticlesCollision3D-derived node.
 *
 * Registered under the abstract key 'GPUParticlesCollision3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * 4 subclasses through the
 * NODE_BASE_TYPES base-walk.
 *
 * Declare only GPUParticlesCollision3D's OWN members: the ones doc/classes/GPUParticlesCollision3D.xml
 * lists without an `overrides=` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesCollision3D', {
  // gpu_particles_collision_3d.cpp:51, PROPERTY_HINT_LAYERS_3D_RENDER. The only
  // member the base binds; every shape property belongs to a leaf.
  cull_mask: layerBitmask('cull_mask', { hinted: 'gpu_particles_collision_3d.cpp:51', width: 'uint32' /* gpu_particles_collision_3d.h:49 */ }),
});
