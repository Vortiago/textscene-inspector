/**
 * SpringBoneCollisionPlane3D strict validators for linting.
 *
 * The class declares no serialisable property of its own, and all four routes a
 * property can take into a `.tscn` come back empty:
 *
 * 1. `ADD_PROPERTY`. The whole translation unit is
 *    scene/3d/spring_bone_collision_plane_3d.cpp:31-43: one include, then the
 *    `_collide` override (lines 33-43) and nothing else. There is no
 *    `_bind_methods` to hold an `ADD_PROPERTY`, and none is synthesised:
 *    GDCLASS calls `_bind_methods()` only when the class's own pointer differs
 *    from its parent's (core/object/object.h:526), which for an unbound class
 *    it does not, so only SpringBoneCollision3D's bind runs.
 * 2. `PropertyListHelper` / `register_property`. Neither name occurs in the
 *    .cpp or the .h.
 * 3. `ADD_ARRAY_COUNT`. Absent from both files, so there is no count-driven
 *    indexed family and no serialised INT behind one.
 * 4. A hand-rolled property-list override. scene/3d/spring_bone_collision_plane_3d.h
 *    declares exactly one member, the protected `_collide` override on lines
 *    38-39. No `_set`, `_get`, `_get_property_list` or `_property_can_revert`
 *    under either spelling, and the .cpp includes no `.compat.inc`.
 *
 * doc/classes/SpringBoneCollisionPlane3D.xml agrees: eleven lines, brief plus
 * description plus an empty `<tutorials>`, with no `<members>` block at all.
 *
 * That is the design rather than an omission. The shape is an infinite XZ plane
 * whose normal is the rotated +Y axis
 * (spring_bone_collision_plane_3d.cpp:36), so it needs no radius, height or
 * extent: everything that places it arrives through SpringBoneCollision3D's
 * `position_offset` and `rotation_offset` on top of the Node3D transform. Those
 * keys are registered on the ancestor and delivered by the NODE_BASE_TYPES
 * base-walk, so re-declaring one here would shadow it and duplicate the rule.
 */

import '../springbonecollision3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('SpringBoneCollisionPlane3D', {});
