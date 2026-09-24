/** LightOccluder2D strict validators for linting: format validation. */

// The base chain: registration happens on import, so a test that loads only this
// slice resolves an inherited key only through this line.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('LightOccluder2D', {
  occluder: v.resourceReference('occluder'),
  sdf_collision: v.boolean('sdf_collision'),
  // light_occluder_2d.cpp:300, PROPERTY_HINT_LAYERS_2D_RENDER, grounds no numeric
  // bound, and set_occluder_light_mask (light_occluder_2d.cpp:257-260) assigns
  // unconditionally, with no ERR_FAIL and no clamp. So no bound is declared
  // (ADR-0032 "none"), only the integer format.
  occluder_light_mask: layerBitmask('occluder_light_mask', { hinted: 'light_occluder_2d.cpp:300', width: 'int32' /* light_occluder_2d.h:102 */ }),
});
