/** GridMap strict validators for linting (format validation). */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('GridMap', {
  transform: v.transform3d('transform'),
  mesh_library: v.resourceReference('mesh_library'),
  cell_size: v.vector3('cell_size'),
});
