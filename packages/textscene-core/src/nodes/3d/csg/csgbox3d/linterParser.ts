/** CSGBox3D strict validators for linting. */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGBox3D', {
  size: v.vector3('size'),
  material: v.resourceReference('material'),
  operation: v.enumInt('operation', 0, 2, OPERATION),
  transform: v.transform3d('transform'),
});
