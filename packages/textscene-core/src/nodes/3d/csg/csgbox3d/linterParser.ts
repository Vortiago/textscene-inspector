/** CSGBox3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGBox3D', {
  size: v.vector3('size'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
