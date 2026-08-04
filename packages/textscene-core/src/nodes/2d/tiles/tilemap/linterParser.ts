/** TileMap strict validators for linting. */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('TileMap', {
  tile_set: v.resourceReference('tile_set'),
  // tile_map.cpp:747, PROPERTY_HINT_NONE with NO_EDITOR|INTERNAL usage — an
  // internal format-version tag Godot itself always writes, not a normal
  // ADD_PROPERTY. TileMap::_set (tile_map.cpp:687-691) casts the value
  // straight into the enum with zero validation (no ERR_FAIL, no clamp,
  // negative included), so no bound belongs here (ADR-0032 "none"); only the
  // integer format is checked.
  format: v.int('format'),
});
