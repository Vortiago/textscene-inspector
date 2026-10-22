/**
 * Strict validation for TubeTrailMesh's own properties, through the `v` combinators.
 * `flip_faces`, `material`, `custom_aabb`, `add_uv2` and `uv2_padding` are `PrimitiveMesh`'s, and the
 * base-walk delivers them to this class.
 */

// Registers PrimitiveMesh and, through it, the rest of the chain, so the
// inherited keys resolve when this module loads alone.
import '../primitivemesh/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('TubeTrailMesh', {
  // primitive_meshes.cpp:2768 hints "0.001,100.0,…,or_greater", so the ceiling is open. `set_radius`
  // (:2387) is a bare assignment, so the floor is the hint's.
  radius: v.float('radius', { min: 0.001, hinted: 'primitive_meshes.cpp:2768' }),
  // primitive_meshes.cpp:2770. `set_radial_steps` (:2402) ERR_FAILs outside 3 to 128.
  radial_steps: v.int('radial_steps', { min: 3, max: 128, enforced: 'primitive_meshes.cpp:2402' }),
  // primitive_meshes.cpp:2771. `set_sections` (:2414) ERR_FAILs outside 2 to 128.
  sections: v.int('sections', { min: 2, max: 128, enforced: 'primitive_meshes.cpp:2414' }),
  // primitive_meshes.cpp:2773 hints "0.001,1024.0,…,or_greater", so the ceiling is open. `set_section_length`
  // (:2422) is a bare assignment.
  section_length: v.float('section_length', { min: 0.001, hinted: 'primitive_meshes.cpp:2773' }),
  // primitive_meshes.cpp:2775 hints "1,128,1" while `set_section_rings` (:2437) ERR_FAILs outside 1 to
  // 1024: the band from 129 to 1024 is stored but past the inspector's slider.
  section_rings: v.int('section_rings', {
    min: 1,
    max: 128,
    enforcedMin: { at: 1 },
    enforcedMax: { at: 1024 },
    enforced: 'primitive_meshes.cpp:2437',
    hinted: { max: 'primitive_meshes.cpp:2775' },
  }),
  // primitive_meshes.cpp:2777-2778
  cap_top: v.boolean('cap_top'),
  cap_bottom: v.boolean('cap_bottom'),
  // primitive_meshes.cpp:2780, a Curve slot.
  curve: v.resourceReference('curve'),
});
