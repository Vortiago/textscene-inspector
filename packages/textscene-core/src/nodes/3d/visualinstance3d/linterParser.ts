/**
 * VisualInstance3D strict validators for its own members, the ones doc/classes/VisualInstance3D.xml
 * lists without `overrides=`. Node3D keys arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

// `sorting_offset` and `sorting_use_aabb_center` get no validator here: their `ADD_PROPERTY` passes
// `PROPERTY_USAGE_NONE`, so neither serialises unless a subclass's `_validate_property` re-enables
// it. GeometryInstance3D re-enables both for its whole hierarchy and Decal re-enables
// `sorting_offset`, so the validator belongs to that subclass's slice.

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VisualInstance3D', {
  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "layers", PROPERTY_HINT_LAYERS_3D_RENDER)
  layers: layerBitmask('layers', { hinted: 'visual_instance_3d.cpp:182', width: 'uint32' /* visual_instance_3d.h:72 */ }),
});
