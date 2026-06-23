/**
 * Strict parser validation for QuadMesh SubResource properties. Mirrors
 * PlaneMesh (QuadMesh's base) plus a `size` Vector2 check, so a malformed quad
 * surfaces in the linter rather than silently rendering at its default size.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('QuadMesh', {
  size: v.vector2('size'),
  center_offset: v.vector3('center_offset'),
  flip_faces: v.boolean('flip_faces'),
});
