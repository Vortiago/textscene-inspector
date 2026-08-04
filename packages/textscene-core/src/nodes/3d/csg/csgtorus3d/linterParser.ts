/** CSGTorus3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

// Ranges are Godot's own editor hints (csg_shape.cpp:2072-2075). `transform` is
// deliberately NOT re-declared: the Node3D base walk supplies it, and a shadow copy
// here would drift from the base without anything noticing.
validatorRegistry.registerAll('CSGTorus3D', {
  // set_inner_radius/set_outer_radius (csg_shape.cpp:2081-2093) are bare
  // assignments; the hints (:2072-2073) are advisory only.
  inner_radius: v.positiveFloat('inner_radius', undefined, { hinted: 'csg_shape.cpp:2072' }),
  outer_radius: v.positiveFloat('outer_radius', undefined, { hinted: 'csg_shape.cpp:2073' }),
  // set_sides:2100-2101 ERR_FAIL_COND(p_sides < 3): the floor is enforced.
  // The hint's (:2074) ceiling of 64 is closed (no or_greater) but never
  // checked by the setter, so it is a warning, not an error.
  sides: v.int('sides', {
    min: 3,
    max: 64,
    enforced: { min: 'csg_shape.cpp:2101' },
    hinted: { max: 'csg_shape.cpp:2074' },
  }),
  // set_ring_sides:2112-2113 ERR_FAIL_COND(p_ring_sides < 3): same split.
  ring_sides: v.int('ring_sides', {
    min: 3,
    max: 64,
    enforced: { min: 'csg_shape.cpp:2112' },
    hinted: { max: 'csg_shape.cpp:2075' },
  }),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
