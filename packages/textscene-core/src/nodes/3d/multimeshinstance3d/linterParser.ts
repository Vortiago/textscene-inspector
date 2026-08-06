/**
 * MultiMeshInstance3D strict validators for linting.
 *
 * Declare only MultiMeshInstance3D's OWN members — the ones doc/classes/MultiMeshInstance3D.xml
 * lists without an `overrides=` attribute. Everything from GeometryInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * This class binds exactly one property. Confirmed via all four routes:
 * `_bind_methods` in scene/3d/multimesh_instance_3d.cpp has a single ADD_PROPERTY;
 * no PropertyListHelper/register_property, no ADD_ARRAY_COUNT, no `_set`/`_get`/
 * `get_property_list` override (grepped both spellings) anywhere in
 * multimesh_instance_3d.cpp or .h, and there is no `.compat.inc` for this class.
 */

import '../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiMeshInstance3D', {
  // scene/3d/multimesh_instance_3d.cpp:57, ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "multimesh", PROPERTY_HINT_RESOURCE_TYPE, "MultiMesh"), "set_multimesh",
  // "get_multimesh"). set_multimesh (:66-74) is a bare assignment — no clamp, no
  // ERR_FAIL — so only the reference SHAPE is checked, same as GeometryInstance3D's
  // material_overlay/material_override.
  multimesh: v.resourceReference('multimesh'),
});
