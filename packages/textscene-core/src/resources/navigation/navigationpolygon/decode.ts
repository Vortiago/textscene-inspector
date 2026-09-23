/**
 * NavigationPolygon decode: `vertices = PackedVector2Array(x, y, …)` and `polygons =
 * Array[PackedInt32Array]([PackedInt32Array(i, …), …])`, the resource's two internal
 * properties (`scene/resources/2d/navigation_polygon.cpp:587-588`). No THREE: vertices
 * stay in Godot 2D space (+Y down), and `r3f/navigationOverlay.ts` converts them.
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
 * drawable: absent, empty, unreadable, or without one surviving polygon. Never
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
  // fractional, so it is dropped rather than hand THREE a ragged array.
  const vertices =
    flat.length === vertexCount * FLOATS_PER_VERTEX
      ? flat
      : flat.slice(0, vertexCount * FLOATS_PER_VERTEX);

  let indexLists: number[][];
  try {
    // `_get_polygons` returns a `TypedArray<Vector<int32_t>>`, so Godot prints the
    // typed wrapper (`navigation_polygon.cpp:110-119`). The shared reader also takes
    // the bare `[PackedInt32Array(…)]` the 3D sibling prints.
    indexLists = parsePackedInt32Arrays(polygonsLiteral);
  } catch {
    warn(`[NavigationPolygon] Unreadable polygons, no navmesh drawn: ${polygonsLiteral}`);
    return null;
  }

  const polygons = drawableNavigationPolygons(indexLists, vertexCount);
  if (polygons.length === 0) return null;

  return { vertices, polygons };
}
