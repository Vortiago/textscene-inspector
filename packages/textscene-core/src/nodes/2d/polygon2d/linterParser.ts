/**
 * Polygon2D strict validators for linting. Validates the Polygon2D-specific
 * surface (fill color, offset, texture, antialiasing, invert, texture
 * transform); the Node2D transform/modulate base props stay lenient like the
 * other 2D slices. `polygon` has no strict format validator and is accepted
 * as-is; `uv` does, because a malformed one silently mis-maps the texture
 * rather than dropping the shape.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Polygon2D', {
  color: v.color('color'),
  offset: v.vector2('offset'),
  texture: v.resourceReference('texture'),
  antialiased: v.boolean('antialiased'),
  invert_enabled: v.boolean('invert_enabled'),
  invert_border: v.float('invert_border'),
  // polygon_2d.cpp:722 hints "0,1000" hard both ends; set_internal_vertex_count
  // (polygon_2d.cpp:418-420) assigns unconditionally, no ERR_FAIL/clamp — a
  // warning, not an error (ADR-0032).
  internal_vertex_count: v.int('internal_vertex_count', { min: 0, hinted: 'polygon_2d.cpp:722' }),
  texture_offset: v.vector2('texture_offset'),
  texture_scale: v.vector2('texture_scale'),
  texture_rotation: v.float('texture_rotation'),
  uv: v.packedVector2Array('uv'),
});
