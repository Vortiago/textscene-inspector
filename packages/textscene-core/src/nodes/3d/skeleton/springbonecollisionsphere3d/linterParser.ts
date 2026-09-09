/**
 * SpringBoneCollisionSphere3D strict validators for linting.
 *
 * Declare only SpringBoneCollisionSphere3D's OWN members, the ones
 * doc/classes/SpringBoneCollisionSphere3D.xml lists without an `overrides=`
 * attribute. Everything from SpringBoneCollision3D up is registered on the
 * ancestor and delivered by the NODE_BASE_TYPES base-walk, so re-declaring an
 * inherited key shadows it and duplicates the rule.
 *
 * The class reaches a `.tscn` through ADD_PROPERTY alone: two calls at
 * spring_bone_collision_sphere_3d.cpp:61-62, no PropertyListHelper, no
 * ADD_ARRAY_COUNT, no `_set`/`_get`/property-list override, and no `.compat.inc`.
 */

import '../springbonecollision3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringBoneCollisionSphere3D', {
  // spring_bone_collision_sphere_3d.cpp:61 hints PROPERTY_HINT_RANGE
  // "0,1,0.001,or_greater,suffix:m": `or_greater` opens the max end, so the 1 is
  // only where the inspector's slider stops and no ceiling exists. The 0 floor
  // is real but merely hinted: set_radius (spring_bone_collision_sphere_3d.cpp:33-38)
  // assigns straight through and only refreshes the editor gizmo, with no clamp
  // and no ERR_FAIL, so a negative radius is stored verbatim and reloads. ADR-0032
  // makes that a warning, grounded in the hint rather than in the setter.
  radius: v.nonNegativeFloat('radius', { hinted: 'spring_bone_collision_sphere_3d.cpp:61' }),
  // spring_bone_collision_sphere_3d.cpp:62 binds it with no hint argument at all,
  // and set_inside (spring_bone_collision_sphere_3d.cpp:44-49) assigns straight
  // through, so only the literal's form is checkable. The flag reverses the
  // collision test in _collide_sphere (:65-74), which subtracts a bone radius
  // supplied by SpringBoneSimulator3D rather than held here, so it constrains
  // nothing about this node's own radius.
  inside: v.boolean('inside'),
});
