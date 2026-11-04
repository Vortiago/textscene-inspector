/**
 * Strict parser validation for HeightMapShape3D's OWN properties.
 */

// Registers the Shape3D tier this class inherits from, and through it the
// Resource tier the chain terminates at, so an inherited key still resolves
// when this module is loaded on its own.
import '../shape3d/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('HeightMapShape3D', {
  // height_map_shape_3d.cpp:356-357 hint "1,100,1,or_greater", so the ceiling is open and never
  // warns. `set_map_width` (:156) and `set_map_depth` (:180) ignore a value below one: an error.
  map_width: v.int('map_width', { min: 1, enforced: { min: 'height_map_shape_3d.cpp:156' } }),
  map_depth: v.int('map_depth', { min: 1, enforced: { min: 'height_map_shape_3d.cpp:180' } }),
  // No hint (:358). `set_map_data` (:203-206) drops a count other than `map_width * map_depth`.
  map_data: v.packedFloat32Array('map_data', '0, 1, 2, 3'),
});
