/**
 * Strict validation for RibbonTrailMesh's own properties, through the `v` combinators.
 * `flip_faces`, `material`, `custom_aabb`, `add_uv2` and `uv2_padding` are `PrimitiveMesh`'s, and the
 * base-walk delivers them to this class.
 */

// Registers PrimitiveMesh and, through it, the rest of the chain, so the
// inherited keys resolve when this module loads alone.
import '../primitivemesh/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { RIBBON_TRAIL_MESH_SHAPE_NAMES } from '../../../godot/scene/ribbonTrailMesh.js';

validatorRegistry.registerAll('RibbonTrailMesh', {
  // primitive_meshes.cpp:3025. `set_shape` (:2788) is a bare assignment.
  shape: v.enumInt('shape', RIBBON_TRAIL_MESH_SHAPE_NAMES, { hinted: 'primitive_meshes.cpp:3025' }),
  // primitive_meshes.cpp:3026 hints "0.001,100.0,…,or_greater", so the ceiling is open. `set_size`
  // (:2799) stores any value but one `is_equal_approx` to the held one (:2800), so the floor is the hint's.
  size: v.float('size', { min: 0.001, hinted: 'primitive_meshes.cpp:3026' }),
  // primitive_meshes.cpp:3027. `set_sections` (:2810) ERR_FAILs outside 2 to 128.
  sections: v.int('sections', { min: 2, max: 128, enforced: 'primitive_meshes.cpp:2814' }),
  // primitive_meshes.cpp:3028 hints "0.001,1024.0,…,or_greater", so the ceiling is open.
  // `set_section_length` (:2822) is a bare assignment.
  section_length: v.float('section_length', { min: 0.001, hinted: 'primitive_meshes.cpp:3028' }),
  // primitive_meshes.cpp:3029 hints "1,128,1" while `set_section_segments` (:2833) ERR_FAILs outside 1
  // to 1024: the band from 129 to 1024 is stored but past the inspector's slider.
  section_segments: v.int('section_segments', {
    min: 1,
    max: 128,
    enforcedMin: { at: 1 },
    enforcedMax: { at: 1024 },
    enforced: 'primitive_meshes.cpp:2837',
    hinted: { max: 'primitive_meshes.cpp:3029' },
  }),
  // primitive_meshes.cpp:3030, a Curve slot.
  curve: v.resourceReference('curve'),
});
