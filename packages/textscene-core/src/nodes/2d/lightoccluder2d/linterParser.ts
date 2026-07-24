/** LightOccluder2D strict validators for linting (format validation). */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('LightOccluder2D', {
  occluder: v.resourceReference('occluder'),
  sdf_collision: v.boolean('sdf_collision'),
});
