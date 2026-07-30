/**
 * Polygon2D parser — Node2D transform/modulate plus the filled-polygon surface
 * (polygon outline, flat fill color, offset, optional texture reference).
 * Godot defaults: color = white, offset = (0,0).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import { boolOr, floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import {
  parsePackedColorArray,
  parsePackedInt32Arrays,
  parsePackedVector2Array,
} from '../../../resources/shapes/packedArray';
import { warn } from '../../../logger';
import type { Polygon2DProperties } from './types';

export function parsePolygon2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Polygon2DProperties {
  const base = parseNode2D(heading, properties);

  let polygon: Float32Array = new Float32Array(0);
  if (properties.polygon) {
    try {
      polygon = parsePackedVector2Array(properties.polygon);
    } catch (error) {
      warn(
        `Polygon2D "${base.name}": invalid polygon ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // `polygons` is an Array of PackedInt32Array index lists. A malformed value
  // degrades to "no sub-polygons", i.e. the stored vertex order.
  let polygons: number[][] = [];
  if (properties.polygons) {
    try {
      polygons = parsePackedInt32Arrays(properties.polygons);
    } catch (error) {
      warn(
        `Polygon2D "${base.name}": invalid polygons ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // `uv` and `vertex_colors` degrade to empty, which is exactly Godot's
  // "sizes don't match" branch: point coordinates stand in for UVs, and the
  // flat `color` stands in for per-vertex colors.
  let uv: Float32Array = new Float32Array(0);
  if (properties.uv) {
    try {
      uv = parsePackedVector2Array(properties.uv);
    } catch (error) {
      warn(
        `Polygon2D "${base.name}": invalid uv ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  let vertexColors: Float32Array = new Float32Array(0);
  if (properties.vertex_colors) {
    try {
      vertexColors = parsePackedColorArray(properties.vertex_colors);
    } catch (error) {
      warn(
        `Polygon2D "${base.name}": invalid vertex_colors ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

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
