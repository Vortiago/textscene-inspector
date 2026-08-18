/**
 * OccluderInstance3D strict validators for linting.
 *
 * Declare only OccluderInstance3D's OWN members — the ones doc/classes/OccluderInstance3D.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `sorting_offset` and `sorting_use_aabb_center` are documented VisualInstance3D
 * members but carry no validator here: OccluderInstance3D has no
 * `_validate_property` override (unlike GeometryInstance3D/Decal), so they stay
 * PROPERTY_USAGE_NONE and never reach a `.tscn`.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('OccluderInstance3D', {
  // occluder_instance_3d.cpp:744, ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "occluder", PROPERTY_HINT_RESOURCE_TYPE, "Occluder3D"), ...). set_occluder
  // (:434-461) is a bare Ref<> assignment — no format constraint beyond the
  // reference shape itself.
  occluder: v.resourceReference('occluder'),
  // occluder_instance_3d.cpp:746, ADD_PROPERTY(..., "bake_mask",
  // PROPERTY_HINT_LAYERS_3D_RENDER), ... . set_bake_mask (:472-475) is
  // `bake_mask = p_mask;` — a bare uint32 assignment, no `p_flags & MASK`
  // truncation, so this is the plain 32-bit layer widget, not a maskedBitField.
  bake_mask: layerBitmask('bake_mask', { hinted: 'occluder_instance_3d.cpp:746', width: 'uint32' /* occluder_instance_3d.h:196 */ }),
  // occluder_instance_3d.cpp:747, PROPERTY_HINT_RANGE "0.0,2.0,0.01,suffix:m".
  // set_bake_simplification_distance (:481-483) is `MAX(p_dist, 0.0f)`: the
  // floor is enforced (an ERROR alters the value), the hint's 2.0 ceiling has
  // no `or_greater` but nothing in the setter checks it, so it is a WARNING.
  bake_simplification_distance: v.float('bake_simplification_distance', {
    min: 0,
    max: 2,
    enforced: { min: 'occluder_instance_3d.cpp:482' },
    hinted: { max: 'occluder_instance_3d.cpp:747' },
  }),
});
