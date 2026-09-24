/**
 * SpringBoneCollision3D strict validators. Declare only SpringBoneCollision3D's own members, the
 * ones doc/classes/SpringBoneCollision3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers every key from Node3D up, and re-declaring one shadows it and duplicates the
 * rule.
 */

// Chains to its own base, as every other tier does. Without it, a scoped slice test for any of the
// three collision shapes resolves no Node3D key and leaves `transform` unchecked.
import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringBoneCollision3D', {
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING_NAME, "bone_name"), ...)
  bone_name: v.stringName('bone_name'),
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "bone",
  // PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR), ...), with no PROPERTY_HINT_RANGE, so no
  // bound.
  bone: v.int('bone'),
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::VECTOR3, "position_offset"), ...)
  position_offset: v.vector3('position_offset'),
  // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::QUATERNION, "rotation_offset"), ...)
  rotation_offset: v.quaternion('rotation_offset'),
});
