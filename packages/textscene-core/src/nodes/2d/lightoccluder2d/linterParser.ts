/** LightOccluder2D strict validators for linting (format validation). */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('LightOccluder2D', {
  occluder: v.resourceReference('occluder'),
  sdf_collision: v.boolean('sdf_collision'),
  // A 32-bit Godot layer/mask prop, on the shared bitmask grammar (0..2^32-1)
  // every other mask field in the repo is range-checked with. The CanvasItem
  // `light_mask` beside it is Node2D's, delivered by the base-walk.
  occluder_light_mask: layerBitmask('occluder_light_mask'),
});
