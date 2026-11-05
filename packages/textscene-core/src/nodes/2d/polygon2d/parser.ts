/**
 * Parses a Polygon2D: the Node2D surface plus the filled-polygon surface. Godot
 * defaults `color` to white and `offset` to (0,0).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseColor } from '../../../utils/colorParser';
import { boolOr, floatOr, intOr, packedOr, vec2Or } from '../../../parser/valueParsers';
import {
  NO_FLOATS,
  parsePackedColorArray,
  parsePackedFloat32Array,
  parsePackedInt32Arrays,
  parsePackedVector2Array,
} from '../../../resources/shapes/packedArray';
import { arrayLiteralBody } from '../../../godot/variant/variantParser';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string/string';
import type { Polygon2DBone, Polygon2DProperties } from './types';

export function parsePolygon2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Polygon2DProperties {
  const base = parseNode2D(heading, properties);
  const at = (key: string) => `Polygon2D "${base.name}".${key}`;
  const label = base.name || 'Polygon2D';

  const polygon = packedOr(properties.polygon, parsePackedVector2Array, NO_FLOATS, at('polygon'));

  // `polygons` is an Array of PackedInt32Array index lists. A malformed value
  // degrades to no sub-polygons, so to the stored vertex order.
  const polygons = packedOr(properties.polygons, parsePackedInt32Arrays, [], at('polygons'));

  // `uv` and `vertex_colors` degrade to empty, which is Godot's
  // "sizes do not match" branch: point coordinates stand in for UVs, and the
  // flat `color` stands in for per-vertex colours.
  const uv = packedOr(properties.uv, parsePackedVector2Array, NO_FLOATS, at('uv'));

  const vertexColors = packedOr(
    properties.vertex_colors,
    parsePackedColorArray,
    NO_FLOATS,
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
    textureOffset: vec2Or(properties.texture_offset, { x: 0, y: 0 }, label),
    textureScale: vec2Or(properties.texture_scale, { x: 1, y: 1 }, label),
    textureRotation: floatOr(properties.texture_rotation, 0, 'Polygon2D'),
    // class_polygon2d.html: internal_vertex_count 0, invert_enabled false,
    // invert_border 100.
    internalVertexCount: intOr(properties.internal_vertex_count, 0, 'Polygon2D'),
    invertEnabled: boolOr(properties.invert_enabled, false),
    invertBorder: floatOr(properties.invert_border, 100, 'Polygon2D'),
    color: properties.color ? parseColor(properties.color) : { r: 1, g: 1, b: 1, a: 1 },
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, label),
    bones: packedOr(properties.bones, parseBones, [], at('bones')),
  };

  if (properties.texture) result.texture = properties.texture;
  if (properties.skeleton) result.skeleton = properties.skeleton;

  return result;
}

/**
 * `_set_bones` (`polygon_2d.cpp:588-595`): pairs of a bone path and its weights. An odd count is
 * refused whole. Weights that do not read as a PackedFloat32Array cast to an empty one, which the
 * draw skips for its size.
 */
function parseBones(value: string): Polygon2DBone[] {
  const body = arrayLiteralBody(value);
  if (body === null) throw new Error(`expected an Array literal, got ${value}`);
  const elements = dropTrailingComma(splitTopLevel(body));
  if (elements.length % 2 !== 0)
    throw new Error(`expected path and weights pairs, got ${elements.length} elements`);
  const bones: Polygon2DBone[] = [];
  for (let i = 0; i < elements.length; i += 2) {
    bones.push({ path: elements[i]!, weights: weightsOf(elements[i + 1]!) });
  }
  return bones;
}

function weightsOf(value: string): Float32Array {
  try {
    return new Float32Array(parsePackedFloat32Array(value));
  } catch {
    // Another Variant casts to an empty PackedFloat32Array, which no vertex count matches.
    return NO_FLOATS;
  }
}
