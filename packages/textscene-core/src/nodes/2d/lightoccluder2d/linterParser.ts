/** LightOccluder2D strict validators for linting (format validation). */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('LightOccluder2D', {
  occluder: v.resourceReference('occluder'),
  sdf_collision: v.boolean('sdf_collision'),
  // light_occluder_2d.cpp:300, PROPERTY_HINT_LAYERS_2D_RENDER — not a
  // PROPERTY_HINT_RANGE, so there is no numeric hint to ground a bound on.
  // set_occluder_light_mask (light_occluder_2d.cpp:257-260) assigns
  // unconditionally, no ERR_FAIL, no clamp. The 0..2^32-1 `layerBitmask` bound
  // this used to carry was never engine-enforced, so it is removed here
  // (ADR-0032 "none"); only the integer format is checked.
  occluder_light_mask: layerBitmask('occluder_light_mask', { hinted: 'light_occluder_2d.cpp:300' }),
});
