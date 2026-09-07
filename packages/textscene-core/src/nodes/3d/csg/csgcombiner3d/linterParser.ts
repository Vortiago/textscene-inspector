/** CSGCombiner3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { csgShapeValidators } from '../sharedLinter.js';

// A combiner is a CSGShape3D but NOT a CSGPrimitive3D, so it has no `material`,
// no `smooth_faces` and no `flip_faces`. `transform` comes from the Node3D base walk.
validatorRegistry.registerAll('CSGCombiner3D', {
  ...csgShapeValidators,
});
