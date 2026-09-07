/** CSGCylinder3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { csgShapeValidators } from '../sharedLinter.js';

validatorRegistry.registerAll('CSGCylinder3D', {
  radius: v.positiveFloat('radius'),
  height: v.positiveFloat('height'),
  sides: v.int('sides', { min: 3, max: 64 }),
  cone: v.boolean('cone'),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  ...csgShapeValidators,
});
