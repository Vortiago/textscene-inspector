/**
 * Strict parser validation for PlaneMesh SubResource properties, entirely
 * through the shared `v` combinators.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// Register validators for PlaneMesh properties. `size`/`center_offset` are
// validated here too so the base validates the same surface as its QuadMesh
// subclass (resources/meshes/quadmesh/linterValidators.ts) — no subclass-stricter
// asymmetry.
validatorRegistry.registerAll('PlaneMesh', {
  size: v.vector2('size'),
  center_offset: v.vector3('center_offset'),
  flip_faces: v.boolean('flip_faces'),
});
