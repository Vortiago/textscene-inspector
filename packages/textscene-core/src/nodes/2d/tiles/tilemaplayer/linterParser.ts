/** TileMapLayer strict validators for linting. */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('TileMapLayer', {
  transform: v.transform2d('transform'),
  position: v.vector2('position'),
});
