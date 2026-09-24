/**
 * Strict parser validation for SphereShape3D's OWN properties.
 */

// Registers the Shape3D tier this class inherits from, and through it the
// Resource tier the chain terminates at, so an inherited key still resolves
// when this module is loaded on its own.
import '../shape3d/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('SphereShape3D', {
  // sphere_shape_3d.cpp:100 hints "0.001,100,…,or_greater", so the ceiling is open and
  // never warns. The floor has two tiers: `set_radius` (sphere_shape_3d.cpp:86) is
  // `ERR_FAIL_COND_MSG(p_radius < 0)`, refusing a negative, while the band between 0 and
  // the hint's floor is stored but unreachable from the inspector.
  radius: v.float('radius', {
    min: 0.001,
    enforcedMin: { at: 0 },
    enforced: { min: 'sphere_shape_3d.cpp:86' },
    hinted: { min: 'sphere_shape_3d.cpp:100' },
  }),
});
