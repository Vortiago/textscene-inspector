/** CSGMesh3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

// `transform` comes from the Node3D base walk and is deliberately not shadowed here.
validatorRegistry.registerAll('CSGMesh3D', {
  mesh: v.resourceReference('mesh'),
  material: v.resourceReference('material'),
  flip_faces: v.boolean('flip_faces'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
