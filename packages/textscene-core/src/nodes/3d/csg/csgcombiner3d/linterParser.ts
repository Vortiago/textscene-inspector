/** CSGCombiner3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

// A combiner is a CSGShape3D but NOT a CSGPrimitive3D, so it has no `material`,
// no `smooth_faces` and no `flip_faces`. `transform` comes from the Node3D base walk.
validatorRegistry.registerAll('CSGCombiner3D', {
  operation: v.enumInt('operation', 0, 2, OPERATION),
});
