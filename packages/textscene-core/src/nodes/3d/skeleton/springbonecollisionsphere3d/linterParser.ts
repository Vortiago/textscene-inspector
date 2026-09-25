/**
 * SpringBoneCollisionSphere3D strict validators. It reaches a `.tscn` through `ADD_PROPERTY` alone:
 * two calls at spring_bone_collision_sphere_3d.cpp:61-62, and no `PropertyListHelper`,
 * `ADD_ARRAY_COUNT`, `_set`/`_get`/property-list override or `.compat.inc`.
 */

// Declare only SpringBoneCollisionSphere3D's own members, the ones
// doc/classes/SpringBoneCollisionSphere3D.xml lists without `overrides=`. The NODE_BASE_TYPES
// base-walk delivers every key from SpringBoneCollision3D up, and re-declaring one shadows it and
// duplicates the rule.
import '../springbonecollision3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringBoneCollisionSphere3D', {
  // spring_bone_collision_sphere_3d.cpp:61 hints PROPERTY_HINT_RANGE
  // "0,1,0.001,or_greater,suffix:m": `or_greater` opens the max end, so no ceiling exists.
  // set_radius (spring_bone_collision_sphere_3d.cpp:33-38) assigns with no clamp and no ERR_FAIL,
  // so a negative radius reloads verbatim and the 0 floor warns (ADR-0032).
  radius: v.nonNegativeFloat('radius', { hinted: 'spring_bone_collision_sphere_3d.cpp:61' }),
  // spring_bone_collision_sphere_3d.cpp:62 binds it with no hint, and set_inside
  // (spring_bone_collision_sphere_3d.cpp:44-49) assigns straight through, so only the literal's
  // form is checkable. It reverses the test in _collide_sphere (:65-74) against a bone radius
  // SpringBoneSimulator3D supplies, so it constrains nothing about this node's radius.
  inside: v.boolean('inside'),
});
