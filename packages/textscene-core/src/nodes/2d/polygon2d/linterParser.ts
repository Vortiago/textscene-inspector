/**
 * Polygon2D strict validators for linting. Validates the Polygon2D-specific
 * surface (fill color, offset, texture, antialiasing, invert, texture
 * transform); the Node2D transform/modulate base props stay lenient like the
 * other 2D slices. `polygon` has no strict format validator and is accepted
 * as-is; `uv` does, because a malformed one silently mis-maps the texture
 * rather than dropping the shape.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Polygon2D', {
  color: v.color('color'),
  offset: v.vector2('offset'),
  texture: v.resourceReference('texture'),
  antialiased: v.boolean('antialiased'),
  invert_enabled: v.boolean('invert_enabled'),
  invert_border: v.float('invert_border'),
  internal_vertex_count: v.int('internal_vertex_count', { min: 0 }),
  texture_offset: v.vector2('texture_offset'),
  texture_scale: v.vector2('texture_scale'),
  texture_rotation: v.float('texture_rotation'),
  uv: v.packedVector2Array('uv'),
});
