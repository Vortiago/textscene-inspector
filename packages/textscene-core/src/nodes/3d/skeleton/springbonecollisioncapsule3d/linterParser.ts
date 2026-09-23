/**
 * SpringBoneCollisionCapsule3D strict validators. It reaches a `.tscn` through `ADD_PROPERTY` alone
 * (no `PropertyListHelper`, `ADD_ARRAY_COUNT`, `_set`/`_get` or `.compat.inc`): four are bound, and
 * three serialise. Each setter rewrites the other float to keep `radius <= height * 0.5` (:37-38,
 * :51-52), a cross-field condition linter.ts checks.
 */

// Declare only SpringBoneCollisionCapsule3D's own members, the ones
// doc/classes/SpringBoneCollisionCapsule3D.xml lists without `overrides=`. The NODE_BASE_TYPES
// base-walk delivers every key from SpringBoneCollision3D up, and re-declaring one shadows it and
// duplicates the rule.
import '../springbonecollision3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Both floats hint "0,1,0.001,or_greater,suffix:m": `,or_greater` opens the max end, and each
// setter keeps its own argument (`radius = p_radius` at :36, `height = p_height` at :50), so the
// floor only warns (ADR-0032). Neither refuses a non-finite value, so `inf` and `nan` pass.
validatorRegistry.registerAll('SpringBoneCollisionCapsule3D', {
  // ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "radius", PROPERTY_HINT_RANGE, "0,1,0.001,or_greater,suffix:m"), ...)
  radius: v.float('radius', { min: 0, hinted: { min: 'spring_bone_collision_capsule_3d.cpp:101' } }),
  // ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "height", PROPERTY_HINT_RANGE, "0,1,0.001,or_greater,suffix:m"), ...)
  height: v.float('height', { min: 0, hinted: { min: 'spring_bone_collision_capsule_3d.cpp:102' } }),
  // ADD_PROPERTY(PropertyInfo(Variant::BOOL, "inside"), ...) at spring_bone_collision_capsule_3d.cpp:104
  inside: v.boolean('inside'),
  // `mid_height` (spring_bone_collision_capsule_3d.cpp:103) is PROPERTY_USAGE_NONE: an
  // inspector-side wrapper that rewrites `height` and is never stored. Its
  // `ERR_FAIL_COND_MSG(p_mid_height < 0.0f)` at :64 guards a value no `.tscn` carries, so it gets
  // no validator.
});
