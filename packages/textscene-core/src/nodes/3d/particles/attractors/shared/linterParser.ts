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

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractor3D', {
  // gpu_particles_collision_3d.cpp:900, PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_greater,or_less": both ends soft, so no bound. A negative
  // strength repels rather than attracts.
  strength: v.float('strength'),
  // :901, PROPERTY_HINT_EXP_EASING "0,8,0.01". set_attenuation:868-871 is a
  // bare assignment.
  attenuation: v.nonNegativeFloat('attenuation', { hinted: 'gpu_particles_collision_3d.cpp:901' }),
  // :902, PROPERTY_HINT_RANGE "0,1,0.01", no or_greater: a hard 0-1.
  // set_directionality:877-881 is a bare assignment.
  directionality: v.float('directionality', {
    min: 0,
    max: 1,
    hinted: 'gpu_particles_collision_3d.cpp:902',
  }),
  // :903, PROPERTY_HINT_LAYERS_3D_RENDER.
  cull_mask: layerBitmask('cull_mask', { hinted: 'gpu_particles_collision_3d.cpp:903', width: 'uint32' /* gpu_particles_collision_3d.h:286 */ }),
});
