/**
 * JacobianIK3D strict validators for linting.
 *
 * JacobianIK3D declares NOTHING of its own, and the empty registration below is
 * therefore the complete one rather than a stub. `jacobian_ik_3d.h:35-40` is the
 * class in full: a GDCLASS macro and one protected `_solve_iteration` override.
 * There is no `_bind_methods` for an `ADD_PROPERTY` to sit in, neither
 * `_get_property_list` nor the unprefixed `get_property_list` is overridden so
 * it contributes no `settings/<i>/` leaf either, and
 * `doc/classes/JacobianIK3D.xml` carries no `<members>` block at all.
 *
 * That fits what the class is: a solver STRATEGY, swapping the Jacobian
 * transpose step into the loop its base already parameterises. Every key a
 * scene writes on a JacobianIK3D belongs to IterateIK3D
 * (`iterate_ik_3d.cpp:394-398`, plus the hand-rolled `settings/<i>/` family at
 * `iterate_ik_3d.cpp:113-116`) or further up, and arrives through the
 * NODE_BASE_TYPES base-walk. Re-declaring one here would shadow the ancestor's
 * validator, so the right move is to declare none.
 *
 * The call still has to happen: `registerAll` is what puts the type in the
 * registry, which is what makes `getOwnKeys('JacobianIK3D')` an assertable
 * empty rather than an absence nobody can tell from an unwired slice.
 */

import '../iterateik3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('JacobianIK3D', {});
