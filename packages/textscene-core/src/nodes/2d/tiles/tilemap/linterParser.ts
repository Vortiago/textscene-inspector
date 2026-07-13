/** TileMap strict validators for linting. */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('TileMap', {
  tile_set: v.resourceReference('tile_set'),
  format: v.strictNonNegativeInt('format'),
});
