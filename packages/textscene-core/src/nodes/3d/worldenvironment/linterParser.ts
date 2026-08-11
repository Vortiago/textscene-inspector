/**
 * WorldEnvironment strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('WorldEnvironment', {
  environment: v.resourceReference('environment'),
  camera_attributes: v.resourceReference('camera_attributes'),
  // world_environment.cpp:221, ADD_PROPERTY(Variant::OBJECT, "compositor", …),
  // identical to Camera3D's own `compositor` (camera_3d.cpp:676): same
  // PROPERTY_HINT_RESOURCE_TYPE "Compositor", same treatment. set_compositor
  // (:159-178) is a bare assignment once the equality short-circuit passes, so
  // only the reference format is checkable.
  compositor: v.resourceReference('compositor'),
});
