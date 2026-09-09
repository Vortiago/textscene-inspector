/**
 * CCDIK3D strict validators for linting: there are none, and that is a finding
 * rather than an omission.
 *
 * CCDIK3D binds no properties at all. Its class body is two lines, `GDCLASS`
 * and one override (`ccd_ik_3d.h:35-40`), and the whole `.cpp` is that
 * override's definition (`ccd_ik_3d.cpp:33`). It has no `_bind_methods`, so no
 * `ADD_PROPERTY` and no `ADD_ARRAY_COUNT`; and neither `_get_property_list` nor
 * the unprefixed `get_property_list` that `ChainIK3D` uses further up the chain
 * (`chain_ik_3d.cpp:115`), so it contributes no hand-rolled `settings/` leaf
 * either. `doc/classes/CCDIK3D.xml` carries no `<members>` block, which agrees.
 * The subclass exists to swap the solve step, not to add state.
 *
 * Everything a `.tscn` may write on a CCDIK3D therefore belongs to an ancestor,
 * and the NODE_BASE_TYPES base-walk delivers it:
 *
 * - `max_iterations`, `min_distance`, `angular_delta_limit`, `deterministic`
 *   and the `setting_count` array counter, IterateIK3D
 *   (`iterate_ik_3d.cpp:394-398`).
 * - the `settings/<i>/target_node` and `settings/<i>/joints/<j>/...` leaves,
 *   IterateIK3D again (`iterate_ik_3d.cpp:113-135`).
 * - the `settings/<i>/root_bone*`, `end_bone*`, `extend_end_bone` and
 *   `joint_count` leaves, ChainIK3D (`chain_ik_3d.cpp:125-137`).
 * - `mutable_bone_axes`, IKModifier3D (`ik_modifier_3d.cpp:64`).
 * - `active` and `influence`, SkeletonModifier3D, registered in that slice.
 *
 * Re-declaring any of them here would shadow the ancestor's validator with a
 * duplicate that then drifts from it, so the registration below stays empty.
 * The call itself is kept because the slice shape is what the conformance tests
 * read, and because `linterParser.test.ts` asserts the empty own-key set
 * against a registration that really happened.
 */

import '../iterateik3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('CCDIK3D', {});
