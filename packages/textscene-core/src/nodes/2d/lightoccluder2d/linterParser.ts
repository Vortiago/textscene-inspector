/** LightOccluder2D strict validators for linting (format validation). */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('LightOccluder2D', {
  occluder: v.resourceReference('occluder'),
  sdf_collision: v.boolean('sdf_collision'),
  // 32-bit Godot layer/mask props — the shared bitmask grammar (0..2^32-1)
  // every other mask field in the repo is range-checked with.
  light_mask: layerBitmask('light_mask'),
  occluder_light_mask: layerBitmask('occluder_light_mask'),
});
