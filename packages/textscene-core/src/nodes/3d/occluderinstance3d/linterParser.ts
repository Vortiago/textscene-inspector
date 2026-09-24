/**
 * OccluderInstance3D strict validators for linting: only its own members, the ones
 * doc/classes/OccluderInstance3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from VisualInstance3D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// `sorting_offset` and `sorting_use_aabb_center` get no validator: OccluderInstance3D has
// no `_validate_property` override, unlike GeometryInstance3D and Decal, so they stay
// PROPERTY_USAGE_NONE and never reach a `.tscn`.
validatorRegistry.registerAll('OccluderInstance3D', {
  // occluder_instance_3d.cpp:744, PROPERTY_HINT_RESOURCE_TYPE "Occluder3D". set_occluder
  // (:434-461) is a bare Ref<> assignment, so only the reference shape is checked.
  occluder: v.resourceReference('occluder'),
  // occluder_instance_3d.cpp:746, PROPERTY_HINT_LAYERS_3D_RENDER. set_bake_mask
  // (:472-475) is a bare uint32 assignment with no `p_flags & MASK`, so this is the plain
  // 32-bit layer widget, not a maskedBitField.
  bake_mask: layerBitmask('bake_mask', { hinted: 'occluder_instance_3d.cpp:746', width: 'uint32' /* occluder_instance_3d.h:196 */ }),
  // occluder_instance_3d.cpp:747, PROPERTY_HINT_RANGE "0.0,2.0,0.01,suffix:m".
  // set_bake_simplification_distance (:481-483) clamps with `MAX(p_dist, 0.0f)`, so the
  // floor errors. Nothing checks the 2.0 ceiling, so it warns.
  bake_simplification_distance: v.float('bake_simplification_distance', {
    min: 0,
    max: 2,
    enforced: { min: 'occluder_instance_3d.cpp:482' },
    hinted: { max: 'occluder_instance_3d.cpp:747' },
  }),
});
