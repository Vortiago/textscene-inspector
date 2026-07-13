/** TileMapLayer strict validators for linting. */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('TileMapLayer', {
  tile_set: v.resourceReference('tile_set'),
  enabled: v.boolean('enabled'),
});
