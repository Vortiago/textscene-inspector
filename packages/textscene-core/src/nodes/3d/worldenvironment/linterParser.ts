/** WorldEnvironment strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only this slice resolves an
// inherited key only if this line pulls in the ancestor.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('WorldEnvironment', {
  environment: v.resourceReference('environment'),
  camera_attributes: v.resourceReference('camera_attributes'),
  // world_environment.cpp:221, ADD_PROPERTY(Variant::OBJECT, "compositor", …), the same
  // PROPERTY_HINT_RESOURCE_TYPE "Compositor" as Camera3D's `compositor` (camera_3d.cpp:676).
  // set_compositor (:159-178) is a bare assignment once the equality short-circuit passes, so only
  // the reference format is checkable.
  compositor: v.resourceReference('compositor'),
});
