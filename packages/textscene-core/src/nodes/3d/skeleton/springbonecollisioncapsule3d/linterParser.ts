/**
 * SpringBoneCollisionCapsule3D strict validators for linting.
 *
 * Declare only SpringBoneCollisionCapsule3D's OWN members, the ones doc/classes/SpringBoneCollisionCapsule3D.xml
 * lists without an `overrides=` attribute. Everything from SpringBoneCollision3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * The class reaches a `.tscn` through plain `ADD_PROPERTY` alone: no
 * `PropertyListHelper`, no `ADD_ARRAY_COUNT`, no `_set`/`_get` override and no
 * `.compat.inc`. Four are bound, of which three serialise.
 *
 * Both floats hint `"0,1,0.001,or_greater,suffix:m"`. `,or_greater` opens the
 * MAX end, so only the floor is checkable, and both setters assign their own
 * argument unaltered (`radius = p_radius` at :36, `height = p_height` at :50),
 * so each floor is the inspector hint's alone and warns rather than errors
 * (ADR-0032). Neither setter refuses a non-finite value, so `inf` and `nan`
 * pass, as the shared numeric validator already allows.
 *
 * What each setter DOES alter is the OTHER property, to keep
 * `radius <= height * 0.5` (:37-38 and :51-52). That is a cross-field condition
 * no single-property validator can see; it lives in this slice's linter.ts.
 */

import '../springbonecollision3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringBoneCollisionCapsule3D', {
  // ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "radius", PROPERTY_HINT_RANGE, "0,1,0.001,or_greater,suffix:m"), ...)
  radius: v.float('radius', { min: 0, hinted: { min: 'spring_bone_collision_capsule_3d.cpp:101' } }),
  // ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "height", PROPERTY_HINT_RANGE, "0,1,0.001,or_greater,suffix:m"), ...)
  height: v.float('height', { min: 0, hinted: { min: 'spring_bone_collision_capsule_3d.cpp:102' } }),
  // ADD_PROPERTY(PropertyInfo(Variant::BOOL, "inside"), ...) at spring_bone_collision_capsule_3d.cpp:104
  inside: v.boolean('inside'),
  // `mid_height` (spring_bone_collision_capsule_3d.cpp:103) is bound
  // PROPERTY_USAGE_NONE: an inspector-side wrapper that rewrites `height`, never
  // stored. Its `ERR_FAIL_COND_MSG(p_mid_height < 0.0f)` at :64 therefore guards
  // a value no `.tscn` can carry, so validating the key would only ever fire on
  // something Godot cannot write.
});
