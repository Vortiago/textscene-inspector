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
});
