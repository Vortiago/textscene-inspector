/** CSGCylinder3D strict validators for linting. */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGCylinder3D', {
  // set_radius/set_height (csg_shape.cpp:1855-1869) are bare assignments; the
  // hints (:1847-1848) are advisory only.
  radius: v.positiveFloat('radius', undefined, { hinted: 'csg_shape.cpp:1847' }),
  height: v.positiveFloat('height', undefined, { hinted: 'csg_shape.cpp:1848' }),
  // set_sides:1876 ERR_FAIL_COND(p_sides < 3): the floor is enforced. The
  // hint's (:1849) ceiling of 64 is closed (no or_greater) but never checked
  // by the setter, so it is a warning, not an error.
  sides: v.int('sides', {
    min: 3,
    max: 64,
    enforced: { min: 'csg_shape.cpp:1876' },
    hinted: { max: 'csg_shape.cpp:1849' },
  }),
  cone: v.boolean('cone'),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
