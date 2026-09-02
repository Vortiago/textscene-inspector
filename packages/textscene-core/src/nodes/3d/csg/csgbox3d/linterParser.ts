/** CSGBox3D strict validators for linting. */

import '../csgprimitive3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CSGBox3D', {
  size: v.vector3('size'),
  material: v.resourceReference('material'),
});
