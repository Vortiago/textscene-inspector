/**
 * Strict parser validation for PlaneMesh's OWN properties, entirely through the
 * shared `v` combinators.
 *
 * `flip_faces`, `material`, `custom_aabb`, `add_uv2` and `uv2_padding` are not
 * here: Godot declares them on `PrimitiveMesh`, and the base-walk delivers them
 * from that slice to this class and to QuadMesh alike.
 */

// Registers PrimitiveMesh and, through it, the rest of the chain, so the
// inherited keys resolve when this module loads alone.
import '../primitivemesh/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PlaneMesh', {
  // primitive_meshes.cpp:1515 (a Vector2, unlike the Vector3 `size` its BoxMesh
  // and QuadMesh-adjacent siblings take) and :1518.
  size: v.vector2('size'),
  center_offset: v.vector3('center_offset'),
  // primitive_meshes.cpp:1516-1517 hint "0,100,1,or_greater", so the ceiling is
  // open. The floor is the setter's, not the hint's: `set_subdivide_width`
  // stores `p_divisions > 0 ? p_divisions : 0` (:1543, and :1555 for depth), so
  // a negative subdivision is altered on the way in rather than merely being
  // outside the inspector's range.
  subdivide_width: v.int('subdivide_width', { min: 0, enforced: 'primitive_meshes.cpp:1543' }),
  subdivide_depth: v.int('subdivide_depth', { min: 0, enforced: 'primitive_meshes.cpp:1555' }),
  // primitive_meshes.cpp:1519; `set_orientation` (:1575) is a bare assignment.
  orientation: v.enumInt(
    'orientation',
    0,
    2,
    { 0: 'FACE_X', 1: 'FACE_Y', 2: 'FACE_Z' },
    { hinted: 'primitive_meshes.cpp:1519' }
  ),
});
