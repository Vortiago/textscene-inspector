/**
 * Strict parser validation for PlaneMesh SubResource properties.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/**
 * Validate boolean properties (flip_faces)
 */
const validateBoolean: PropertyValidator = (key, value, line) => {
  if (value !== 'true' && value !== 'false') {
    return {
      severity: 'error',
      message: `Property "${key}" must be "true" or "false", got: ${value}`,
      line,
      column: 0,
      code: 'INVALID_BOOLEAN',
    };
  }
  return null;
};

// Register validators for PlaneMesh properties. `size`/`center_offset` are
// validated here too so the base validates the same surface as its QuadMesh
// subclass (resources/meshes/quadmesh/linterValidators.ts) — no subclass-stricter
// asymmetry.
validatorRegistry.registerAll('PlaneMesh', {
  size: v.vector2('size'),
  center_offset: v.vector3('center_offset'),
  flip_faces: validateBoolean,
});
