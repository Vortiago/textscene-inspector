/**
 * MultiMeshInstance3D strict validators for linting: only its own members, the ones
 * doc/classes/MultiMeshInstance3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from GeometryInstance3D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

// The class binds one property: scene/3d/multimesh_instance_3d.cpp has one ADD_PROPERTY, and
// neither multimesh_instance_3d.cpp nor its header has a PropertyListHelper,
// `register_property`, ADD_ARRAY_COUNT, `_set`/`_get` or `get_property_list`. No
// `.compat.inc` exists.

import '../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('MultiMeshInstance3D', {
  // scene/3d/multimesh_instance_3d.cpp:57, PROPERTY_HINT_RESOURCE_TYPE "MultiMesh".
  // set_multimesh (:66-74) is a bare assignment, so only the reference shape is checked.
  multimesh: v.resourceReference('multimesh'),
});
