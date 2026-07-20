/** GridMap strict validators for linting (format validation). */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('GridMap', {
  mesh_library: v.resourceReference('mesh_library'),
  cell_size: v.vector3('cell_size'),
  cell_center_x: v.boolean('cell_center_x'),
  cell_center_y: v.boolean('cell_center_y'),
  cell_center_z: v.boolean('cell_center_z'),
});
