/**
 * FABRIK3D strict validators for linting.
 *
 * FABRIK3D declares NO serialisable property of its own, and the empty
 * registration below is that settled fact rather than work outstanding. Three
 * independent sources agree:
 *
 * - `fabr_ik_3d.h:35-40` is the whole class body: `GDCLASS`, a `protected:`
 *   label and one member, the `_solve_iteration` override. No `_bind_methods`,
 *   so no `ADD_PROPERTY` and no `ADD_ARRAY_COUNT` can exist.
 * - `fabr_ik_3d.cpp:33-87` holds that one override and nothing else, so there is
 *   no `_set` / `_get` / property-list triple to hand-roll a
 *   `settings/<i>/<leaf>` key either. Checked for BOTH spellings of the
 *   property-list hook: ChainIK3D up the chain overrides the UNPREFIXED
 *   `get_property_list` (`chain_ik_3d.cpp:115`), so grepping only
 *   `_get_property_list` would miss that shape.
 * - `doc/classes/FABRIK3D.xml` carries no `<members>` block at all.
 *
 * The class is a solver body: the backward-then-forward reaching pass, driven
 * entirely by keys its ancestors declare. Its whole property surface arrives
 * through the NODE_BASE_TYPES base-walk, and re-declaring any of it here would
 * shadow the ancestor's validator and duplicate its rule:
 *
 * - IterateIK3D: `max_iterations`, `min_distance`, `angular_delta_limit`,
 *   `deterministic` and the `setting_count` / `settings/` indexed array
 *   (`iterate_ik_3d.cpp:394-398`). `angular_delta_limit` is the family's
 *   `radians_as_degrees` property, so its hint numbers are degrees while the
 *   stored value is radians; that conversion is IterateIK3D's to apply.
 * - ChainIK3D and IKModifier3D: further `settings/<i>/` leaves, plus
 *   `mutable_bone_axes` (`ik_modifier_3d.cpp:64`).
 * - SkeletonModifier3D and Node3D: the modifier and spatial keys.
 */

import '../iterateik3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('FABRIK3D', {});
