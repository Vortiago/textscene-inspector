/**
 * MultiMeshInstance2D strict validators for linting: the members
 * doc/classes/MultiMeshInstance2D.xml lists, the two ADD_PROPERTY calls in
 * multimesh_instance_2d.cpp (:80-81). No PropertyListHelper, ADD_ARRAY_COUNT or
 * `_set`/`_get`/`get_property_list` route exists in multimesh_instance_2d.cpp or .h.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiMeshInstance2D', {
  // multimesh_instance_2d.cpp:80, ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "multimesh", PROPERTY_HINT_RESOURCE_TYPE, "MultiMesh"), "set_multimesh",
  // "get_multimesh"). set_multimesh (:84-97) never rejects or alters the value, so
  // only the reference shape is checked.
  multimesh: v.resourceReference('multimesh'),
  // multimesh_instance_2d.cpp:81, ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "texture", PROPERTY_HINT_RESOURCE_TYPE, "Texture2D"), …). set_texture (:103-110)
  // is a bare assignment. multimesh_instance_2d.cpp:81 and mesh_instance_2d.cpp:65
  // each bind `texture`, and Node2D does not, so no hoist.
  texture: v.resourceReference('texture'),
});
