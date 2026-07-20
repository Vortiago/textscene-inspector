/**
 * Line2D strict validators for linting. Validates the Line2D-specific surface
 * (width, default_color, closed); `points` (PackedVector2Array) has no strict
 * format validator and is accepted as-is — same convention Polygon2D uses for
 * `polygon`.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Line2D', {
  width: v.float('width'),
  default_color: v.color('default_color'),
  closed: v.boolean('closed'),
  // LineJointMode: SHARP 0, BEVEL 1, ROUND 2.
  joint_mode: v.enumInt('joint_mode', 0, 2, { 0: 'SHARP', 1: 'BEVEL', 2: 'ROUND' }),
  sharp_limit: v.float('sharp_limit', { min: 0 }),
  round_precision: v.int('round_precision', { min: 1 }),
});
