/** CSGCombiner3D strict validators for linting. */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

// A combiner is a CSGShape3D but NOT a CSGPrimitive3D, so it has no `material`,
// no `smooth_faces` and no `flip_faces`. `transform` comes from the Node3D base walk.
validatorRegistry.registerAll('CSGCombiner3D', {
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
