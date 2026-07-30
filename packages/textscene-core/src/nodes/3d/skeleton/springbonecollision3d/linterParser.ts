/**
 * SpringBoneCollision3D strict validators for linting.
 *
 * Declare only SpringBoneCollision3D's OWN members — the ones doc/classes/SpringBoneCollision3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringBoneCollision3D', {
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING_NAME, "bone_name"), ...)
  bone_name: v.stringName('bone_name'),
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "bone", PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR), ...) — no PROPERTY_HINT_RANGE, so no bound
  bone: v.int('bone'),
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::VECTOR3, "position_offset"), ...)
  position_offset: v.vector3('position_offset'),
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::QUATERNION, "rotation_offset"), ...)
  rotation_offset: v.quaternion('rotation_offset'),
});
