/** CSGSphere3D strict validators for linting. */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGSphere3D', {
  // csg_shape.cpp:1470 hints "0.001,100.0,0.001,suffix:m", closed both ends.
  // csg_shape.cpp:1478, ERR_FAIL_COND(p_radius <= 0): the setter refuses at 0,
  // below the hint's own floor, and assigns anything above it straight
  // through, so (0, 0.001) and everything past 100 warn.
  radius: v.float('radius', {
    enforcedMin: { at: 0, exclusive: true },
    min: 0.001,
    max: 100.0,
    enforced: { min: 'csg_shape.cpp:1478' },
    hinted: 'csg_shape.cpp:1470',
  }),
  // csg_shape.cpp:1488-1489, `radial_segments = p_radial_segments > 4 ?
  // p_radial_segments : 4`: a silent clamp to a floor of 4, not the hint's
  // (:1471, "1,100,1") displayed minimum of 1 — a value of 1-3 loads but is
  // coerced. Nothing clamps the top, so the hint's 100 ceiling warns.
  radial_segments: v.int('radial_segments', {
    min: 4,
    max: 100,
    enforced: { min: 'csg_shape.cpp:1489' },
    hinted: { max: 'csg_shape.cpp:1471' },
  }),
  // csg_shape.cpp:1498-1499, `rings = p_rings > 1 ? p_rings : 1`: a clamp to
  // floor 1, matching the hint's (:1472, "1,100,1") displayed minimum; its 100
  // ceiling is again unclamped and warns.
  rings: v.int('rings', {
    min: 1,
    max: 100,
    enforced: { min: 'csg_shape.cpp:1499' },
    hinted: { max: 'csg_shape.cpp:1472' },
  }),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
