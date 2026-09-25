/**
 * MeshInstance2D strict validators for linting: the members
 * doc/classes/MeshInstance2D.xml lists, the two ADD_PROPERTY calls in
 * mesh_instance_2d.cpp (:64-65). No PropertyListHelper, ADD_ARRAY_COUNT or
 * `_set`/`_get`/`get_property_list` route exists in mesh_instance_2d.cpp or .h.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MeshInstance2D', {
  // mesh_instance_2d.cpp:64, ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "mesh",
  // PROPERTY_HINT_RESOURCE_TYPE, "Mesh"), "set_mesh", "get_mesh"). set_mesh
  // (:68-87) never rejects or alters the value, so only the reference shape is
  // checked.
  mesh: v.resourceReference('mesh'),
  // mesh_instance_2d.cpp:65, ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "texture",
  // PROPERTY_HINT_RESOURCE_TYPE, "Texture2D"), …). set_texture (:93-100) is a bare
  // assignment. mesh_instance_2d.cpp:65 and multimesh_instance_2d.cpp:81 each bind
  // `texture`, and Node2D does not, so no hoist.
  texture: v.resourceReference('texture'),
});
