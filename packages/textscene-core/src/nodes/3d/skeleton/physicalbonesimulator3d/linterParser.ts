/**
 * PhysicalBoneSimulator3D declares no serialisable property of its own.
 *
 * The registration below is deliberately empty, and that emptiness is a
 * statement about Godot rather than an unfinished slice. The class exists to
 * drive its `PhysicalBone3D` children and write their simulated poses back onto
 * the `Skeleton3D`; every parameter of that simulation lives on the child bones,
 * which are a separate type with their own slice. What this node holds is
 * runtime state (`simulating`, and a `LocalVector<SimulatedBone>` cache rebuilt
 * from the live skeleton), none of which is exposed as a property.
 *
 * ## All four routes into a `.tscn`, checked
 *
 * 1. `ADD_PROPERTY`: none. `_bind_methods`
 *    (physical_bone_simulator_3d.cpp:386-393) binds five methods and nothing
 *    else: `is_simulating_physics`, `physical_bones_start_simulation`,
 *    `physical_bones_stop_simulation`, and the two collision-exception calls.
 * 2. `PropertyListHelper` / `register_property`: neither appears in the file.
 * 3. `ADD_ARRAY_COUNT`: absent, so there is no count-driven family.
 * 4. A hand-rolled `_set` / `_get` / property-list override: absent under every
 *    spelling. This is the route that matters most here, because the sibling
 *    `BoneConstraint3D` also binds zero `ADD_PROPERTY` and lists no XML member
 *    yet still serialises a whole `settings/<i>/` family through an UNPREFIXED
 *    `get_property_list`. PhysicalBoneSimulator3D overrides neither spelling,
 *    and the file contains no literal key prefix to hang such a family on. Its
 *    only `_`-prefixed overrides are `_set_active`, `_process_modification` and
 *    `_skeleton_changed`, which are SkeletonModifier3D lifecycle hooks rather
 *    than property accessors, plus the internal `_bone_list_changed` and
 *    `_pose_updated` signal handlers.
 *
 * A source read alone would not settle route 4, so it was also measured: a real
 * Godot 4.6.3 instance's `get_property_list()` filtered to
 * `PROPERTY_USAGE_STORAGE` is identical, key for key and in order, to a bare
 * `SkeletonModifier3D`'s. Nothing is added at this tier.
 *
 * `doc/classes/PhysicalBoneSimulator3D.xml` agrees, listing five methods and
 * zero members.
 *
 * The `active` and `influence` a scene writes on this node are
 * SkeletonModifier3D's. They arrive through the NODE_BASE_TYPES base-walk from
 * the import below, and re-declaring either here would shadow the ancestor's
 * bounds with a duplicate.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('PhysicalBoneSimulator3D', {});
