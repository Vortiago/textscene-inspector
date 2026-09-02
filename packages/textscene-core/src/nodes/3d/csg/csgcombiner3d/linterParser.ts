/** CSGCombiner3D strict validators for linting. */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// A combiner is a CSGShape3D but not a CSGPrimitive3D: csg_shape.h:194-202 is
// the whole class and binds nothing, so every key it accepts is inherited.
validatorRegistry.registerAll('CSGCombiner3D', {});
