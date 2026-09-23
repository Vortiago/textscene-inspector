/**
 * FABRIK3D strict validators: none, a settled finding. `fabr_ik_3d.h:35-40` is the whole class body,
 * `GDCLASS` and the `_solve_iteration` override, with no `_bind_methods`. `fabr_ik_3d.cpp:33-87` holds
 * that override alone, with no `_get_property_list` or unprefixed `get_property_list` (ChainIK3D's,
 * `chain_ik_3d.cpp:115`), and `doc/classes/FABRIK3D.xml` has no `<members>` block.
 */

// The base-walk delivers every key, Node3D and SkeletonModifier3D included. IterateIK3D:
// `max_iterations`, `min_distance`, `angular_delta_limit` (radians_as_degrees, converted there),
// `deterministic` and `setting_count`/`settings/` (`iterate_ik_3d.cpp:394-398`). ChainIK3D and
// IKModifier3D: more `settings/<i>/` leaves and `mutable_bone_axes` (`ik_modifier_3d.cpp:64`).
import '../iterateik3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Empty: a re-declared key would shadow the ancestor's validator and duplicate its rule.
validatorRegistry.registerAll('FABRIK3D', {});
