/** CSGSphere3D strict validators for linting. */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGSphere3D', {
  radius: v.positiveFloat('radius'),
  radial_segments: v.int('radial_segments', { min: 1 }),
  rings: v.int('rings', { min: 1 }),
  material: v.resourceReference('material'),
  operation: v.enumInt('operation', 0, 2, OPERATION),
  transform: v.transform3d('transform'),
});
