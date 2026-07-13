/** GridMap strict validators for linting (format validation). */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('GridMap', {
  mesh_library: v.resourceReference('mesh_library'),
  cell_size: v.vector3('cell_size'),
});
