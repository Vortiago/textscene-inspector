/**
 * MeshInstance2D strict validators for linting.
 *
 * Declare only MeshInstance2D's OWN members — the ones doc/classes/MeshInstance2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * This class binds exactly two properties. Confirmed via all four routes:
 * mesh_instance_2d.cpp's `_bind_methods` has exactly two ADD_PROPERTY calls
 * (:64-65); no PropertyListHelper/register_property, no ADD_ARRAY_COUNT, no
 * `_set`/`_get`/`get_property_list` override (grepped both spellings)
 * anywhere in mesh_instance_2d.cpp or .h.
 *
 * `texture` is NOT shared with MultiMeshInstance2D by hoisting: the classes'
 * nearest common ancestor is Node2D, which declares no `texture` of its own —
 * each binds it independently (mesh_instance_2d.cpp:65,
 * multimesh_instance_2d.cpp:81), so two identical validators is correct.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MeshInstance2D', {
  // mesh_instance_2d.cpp:64, ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "mesh",
  // PROPERTY_HINT_RESOURCE_TYPE, "Mesh"), "set_mesh", "get_mesh"). set_mesh
  // (:68-87) reassigns and reconnects the changed signal but never rejects or
  // alters the value — only the reference SHAPE is checked.
  mesh: v.resourceReference('mesh'),
  // mesh_instance_2d.cpp:65, ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "texture",
  // PROPERTY_HINT_RESOURCE_TYPE, "Texture2D"), "set_texture", "get_texture").
  // set_texture (:93-100) is a bare assignment — no clamp, no ERR_FAIL.
  texture: v.resourceReference('texture'),
});
