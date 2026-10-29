/**
 * Parses a Polygon2D: the Node2D surface plus the filled-polygon surface. Godot
 * defaults `color` to white and `offset` to (0,0).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import { boolOr, floatOr, intOr, packedOr, vec2Or } from '../../../parser/valueParsers';
import {
  parsePackedColorArray,
  parsePackedInt32Arrays,
  parsePackedVector2Array,
} from '../../../resources/shapes/packedArray';
import type { Polygon2DProperties } from './types';

export function parsePolygon2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Polygon2DProperties {
  const base = parseNode2D(heading, properties);
  const at = (key: string) => `Polygon2D "${base.name}".${key}`;

  const polygon = packedOr(properties.polygon, parsePackedVector2Array, new Float32Array(0), at('polygon'));

  // `polygons` is an Array of PackedInt32Array index lists. A malformed value
  // degrades to no sub-polygons, so to the stored vertex order.
  const polygons = packedOr(properties.polygons, parsePackedInt32Arrays, [], at('polygons'));

  // `uv` and `vertex_colors` degrade to empty, which is Godot's
  // "sizes do not match" branch: point coordinates stand in for UVs, and the
  // flat `color` stands in for per-vertex colours.
  const uv = packedOr(properties.uv, parsePackedVector2Array, new Float32Array(0), at('uv'));

  const vertexColors = packedOr(
    properties.vertex_colors,
    parsePackedColorArray,
    new Float32Array(0),
    at('vertex_colors')
  );

  const result: Polygon2DProperties = {
    ...base,
    polygon,
    polygons,
    uv,
    vertexColors,
    // class_polygon2d.html: texture_offset (0,0), texture_scale (1,1),
    // texture_rotation 0.
    textureOffset: vec2Or(properties.texture_offset, { x: 0, y: 0 }, base.name || 'Polygon2D'),
    textureScale: vec2Or(properties.texture_scale, { x: 1, y: 1 }, base.name || 'Polygon2D'),
    textureRotation: floatOr(properties.texture_rotation, 0, 'Polygon2D'),
    // class_polygon2d.html: internal_vertex_count 0, invert_enabled false,
    // invert_border 100.
    internalVertexCount: intOr(properties.internal_vertex_count, 0, 'Polygon2D'),
    invertEnabled: boolOr(properties.invert_enabled, false),
    invertBorder: floatOr(properties.invert_border, 100, 'Polygon2D'),
    color: properties.color ? parseColor(properties.color) : { r: 1, g: 1, b: 1, a: 1 },
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, base.name || 'Polygon2D'),
  };

  if (properties.texture) result.texture = properties.texture;

  return result;
}
