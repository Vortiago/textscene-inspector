/**
 * MultiMeshInstance2D strict validators for linting.
 *
 * Declare only MultiMeshInstance2D's OWN members — the ones doc/classes/MultiMeshInstance2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * This class binds exactly two properties. Confirmed via all four routes:
 * multimesh_instance_2d.cpp's `_bind_methods` has exactly two ADD_PROPERTY
 * calls (:80-81); no PropertyListHelper/register_property, no
 * ADD_ARRAY_COUNT, no `_set`/`_get`/`get_property_list` override (grepped
 * both spellings) anywhere in multimesh_instance_2d.cpp or .h.
 *
 * `texture` is NOT shared with MeshInstance2D by hoisting: the classes'
 * nearest common ancestor is Node2D, which declares no `texture` of its own —
 * each binds it independently (multimesh_instance_2d.cpp:81,
 * mesh_instance_2d.cpp:65), so two identical validators is correct.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiMeshInstance2D', {
  // multimesh_instance_2d.cpp:80, ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "multimesh", PROPERTY_HINT_RESOURCE_TYPE, "MultiMesh"), "set_multimesh",
  // "get_multimesh"). set_multimesh (:84-97) reassigns and reconnects the
  // changed signal but never rejects or alters the value — only the
  // reference SHAPE is checked.
  multimesh: v.resourceReference('multimesh'),
  // multimesh_instance_2d.cpp:81, ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "texture", PROPERTY_HINT_RESOURCE_TYPE, "Texture2D"), "set_texture",
  // "get_texture"). set_texture (:103-110) is a bare assignment — no clamp,
  // no ERR_FAIL.
  texture: v.resourceReference('texture'),
});
