/**
 * JacobianIK3D strict validators: none, the complete registration. `jacobian_ik_3d.h:35-40` is the
 * class in full, GDCLASS and one `_solve_iteration` override, with no `_bind_methods`, no
 * property-list override of either spelling and no `<members>` in `doc/classes/JacobianIK3D.xml`.
 * It swaps the Jacobian transpose step into the loop its base parameterises.
 */

// Every key a scene writes belongs to IterateIK3D (`iterate_ik_3d.cpp:394-398`, plus the
// `settings/<i>/` family at `iterate_ik_3d.cpp:113-116`) or further up, through the base-walk.
import '../iterateik3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Empty, since a re-declared key would shadow the ancestor's validator. The call puts the type in
// the registry, so `getOwnKeys('JacobianIK3D')` is an assertable empty, not an unwired slice.
validatorRegistry.registerAll('JacobianIK3D', {});
