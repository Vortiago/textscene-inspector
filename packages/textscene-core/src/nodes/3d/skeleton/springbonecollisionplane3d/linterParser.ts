/**
 * SpringBoneCollisionPlane3D strict validators: none of its own, and
 * doc/classes/SpringBoneCollisionPlane3D.xml has no `<members>`. The shape is an infinite XZ plane
 * whose normal is the rotated +Y axis (spring_bone_collision_plane_3d.cpp:36), so it needs no
 * radius or extent: `position_offset` and `rotation_offset` place it.
 */

// The NODE_BASE_TYPES base-walk delivers those keys from the ancestor, and re-declaring one here
// would shadow it and duplicate the rule.
import '../springbonecollision3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Empty on all four routes. scene/3d/spring_bone_collision_plane_3d.cpp:31-43 holds an include and
// the `_collide` override, with no `_bind_methods`, so only the parent's bind runs
// (core/object/object.h:526). Neither file names `PropertyListHelper` or `ADD_ARRAY_COUNT`, and
// scene/3d/spring_bone_collision_plane_3d.h declares only `_collide`, with no `.compat.inc`.
validatorRegistry.registerAll('SpringBoneCollisionPlane3D', {});
