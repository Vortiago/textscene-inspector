/**
 * Validators shared by every GPUParticlesAttractor3D-derived node, under the abstract key
 * 'GPUParticlesAttractor3D', which appears in no .tscn. The NODE_BASE_TYPES base-walk
 * delivers them. Only its own members: doc/classes/GPUParticlesAttractor3D.xml
 * without `overrides=`, checked against ADD_PROPERTY.
 */

// Registration happens on import, so a test that loads only this slice resolves an
// inherited key only when this line pulls the ancestor in.
import '../../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../../linter/validators/index.js';

validatorRegistry.registerAll('GPUParticlesAttractor3D', {
  // gpu_particles_collision_3d.cpp:900, PROPERTY_HINT_RANGE
  // "-128,128,0.01,or_greater,or_less": both ends soft, so no bound. A negative
  // strength repels rather than attracts.
  strength: v.float('strength'),
  // :901, PROPERTY_HINT_EXP_EASING. Its "0,8,0.01" numbers are discarded
  // (editor_properties.cpp:3944-3953), and without `positive_only` the inspector's
  // Ease In-Out and Ease Out-In presets (:1905-1907) write negative values.
  // set_attenuation:868-871 is a bare assignment, so there is no bound.
  attenuation: v.float('attenuation'),
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
