/**
 * CCDIK3D strict validators: none, by finding. The class body is `GDCLASS` and one override
 * (`ccd_ik_3d.h:35-40`, defined at `ccd_ik_3d.cpp:33`), with no `_bind_methods` and no
 * `get_property_list` of either spelling (ChainIK3D's is at `chain_ik_3d.cpp:115`), and
 * `doc/classes/CCDIK3D.xml` has no `<members>`. It swaps the solve step and adds no state.
 */

// The base-walk delivers every key. IterateIK3D: `max_iterations`, `min_distance`,
// `angular_delta_limit`, `deterministic`, `setting_count` (`iterate_ik_3d.cpp:394-398`) and the
// `target_node`/`joints` leaves (`iterate_ik_3d.cpp:113-135`). ChainIK3D: the bone leaves
// (`chain_ik_3d.cpp:125-137`). IKModifier3D: `mutable_bone_axes` (`ik_modifier_3d.cpp:64`).
import '../iterateik3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Empty, since a re-declared key would shadow the ancestor's validator. SkeletonModifier3D registers
// `active` and `influence`. The call stays: the conformance tests read the slice shape, and
// `linterParser.test.ts` asserts the empty own-key set against a real registration.
validatorRegistry.registerAll('CCDIK3D', {});
