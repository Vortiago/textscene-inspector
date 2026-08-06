/** CSGSphere3D strict validators for linting. */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGSphere3D', {
  // csg_shape.cpp:1478, ERR_FAIL_COND(p_radius <= 0): the setter refuses.
  radius: v.positiveFloat('radius', undefined, { enforced: 'csg_shape.cpp:1478' }),
  // csg_shape.cpp:1488-1489, `radial_segments = p_radial_segments > 4 ?
  // p_radial_segments : 4`: a silent clamp to a floor of 4, not the hint's
  // (:1471) displayed minimum of 1 — a value of 1-3 loads but is coerced.
  radial_segments: v.int('radial_segments', { min: 4, enforced: 'csg_shape.cpp:1489' }),
  // csg_shape.cpp:1498-1499, `rings = p_rings > 1 ? p_rings : 1`: a clamp to
  // floor 1, matching the hint's (:1472) displayed minimum.
  rings: v.int('rings', { min: 1, enforced: 'csg_shape.cpp:1499' }),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
