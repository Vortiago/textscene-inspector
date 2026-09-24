/**
 * PhysicalBoneSimulator3D strict validators: none of its own. The class drives its `PhysicalBone3D`
 * children, which hold every simulation parameter, and keeps only runtime state (`simulating` and a
 * `SimulatedBone` cache). doc/classes/PhysicalBoneSimulator3D.xml lists five methods and zero
 * members.
 */

// `active` and `influence` are SkeletonModifier3D's and arrive through the NODE_BASE_TYPES
// base-walk. Re-declaring either here would shadow the ancestor's bounds.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// Empty on all four routes: `_bind_methods` (physical_bone_simulator_3d.cpp:386-393) binds five
// methods and no `ADD_PROPERTY`, with no `PropertyListHelper`, `ADD_ARRAY_COUNT` or
// `_set`/`_get`/property-list override under either spelling. A 4.6.3 instance's STORAGE property
// list matches a bare SkeletonModifier3D's, key for key.
validatorRegistry.registerAll('PhysicalBoneSimulator3D', {});
