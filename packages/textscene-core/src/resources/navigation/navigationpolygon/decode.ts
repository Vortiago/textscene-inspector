/**
 * NavigationPolygon decode: property bag → vertices + polygon index loops.
 *
 * Godot serializes the resource as exactly two internal properties
 * (`scene/resources/2d/navigation_polygon.cpp:587-588`):
 *
 *   vertices = PackedVector2Array(x, y, …)
 *   polygons = Array[PackedInt32Array]([PackedInt32Array(i, …), …])
 *
 * The typed `Array[PackedInt32Array](…)` wrapper is what `_get_polygons`
 * returning a `TypedArray<Vector<int32_t>>` prints
 * (`navigation_polygon.cpp:110-119`) — the 3D sibling's plain `Array` prints the
 * bare `[PackedInt32Array(…)]` form instead. Neither spelling is load-bearing
 * here: the shared PackedInt32Array reader accepts both.
 *
 * Pure (no THREE): vertices stay in Godot 2D space (+Y down) and the geometry
 * builders in `r3f/navigationOverlay.ts` do the conversion, so this slice has no
 * `build.ts`.
 */

import { warn } from '../../../logger';
import {
  parsePackedInt32Arrays,
  parsePackedVector2Array,
} from '../../shapes/packedArray';
import { drawableNavigationPolygons } from '../polygonIndices';
import type { NavigationPolygonData } from './types';

const FLOATS_PER_VERTEX = 2;

/**
 * Decode a NavigationPolygon's properties, or null when it describes nothing
 * drawable — absent, empty, unreadable, or without one surviving polygon. Never
 * throws: a malformed value degrades to null so a render pass cannot fault on it.
 */
export function decodeNavigationPolygon(
  properties: Record<string, unknown>
): NavigationPolygonData | null {
  // `Record<string, unknown>` serves both arrival paths unchanged: a
  // ParsedResource's `properties` and an inline `[sub_resource]`'s `data`. A
  // non-string value is not a Godot-text literal, so it decodes to nothing.
  const verticesLiteral = properties['vertices'];
  const polygonsLiteral = properties['polygons'];
  if (typeof verticesLiteral !== 'string' || typeof polygonsLiteral !== 'string') return null;
  if (!verticesLiteral || !polygonsLiteral) return null;

  let flat: Float32Array;
  try {
    flat = parsePackedVector2Array(verticesLiteral);
  } catch {
    warn(`[NavigationPolygon] Unreadable vertices, no navmesh drawn: ${verticesLiteral}`);
    return null;
  }

  const vertexCount = Math.floor(flat.length / FLOATS_PER_VERTEX);
  if (vertexCount === 0) return null;
  // A trailing half vertex would leave the position buffer's item count
  // fractional; drop it instead of handing THREE a ragged array.
  const vertices =
    flat.length === vertexCount * FLOATS_PER_VERTEX
      ? flat
      : flat.slice(0, vertexCount * FLOATS_PER_VERTEX);

  let indexLists: number[][];
  try {
    indexLists = parsePackedInt32Arrays(polygonsLiteral);
  } catch {
    warn(`[NavigationPolygon] Unreadable polygons, no navmesh drawn: ${polygonsLiteral}`);
    return null;
  }

  const polygons = drawableNavigationPolygons(indexLists, vertexCount);
  if (polygons.length === 0) return null;

  return { vertices, polygons };
}
