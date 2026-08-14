/**
 * NavigationMesh decode: property bag → vertices + polygon index loops.
 *
 * Godot serializes the walkable surface as two internal properties
 * (`scene/resources/navigation_mesh.cpp:572-573`); every other property on the
 * resource is a bake setting that says nothing about the baked result:
 *
 *   vertices = PackedVector3Array(x, y, z, …)
 *   polygons = [PackedInt32Array(i, …), …]
 *
 * The bare wrapper is what `_get_polygons` returning a plain `Array` prints
 * (`navigation_mesh.cpp:326-335`) — the 2D sibling's `TypedArray` prints
 * `Array[PackedInt32Array](…)` instead. Neither spelling is load-bearing here:
 * the shared PackedInt32Array reader accepts both.
 *
 * Pure (no THREE): the geometry builders in `r3f/navigationOverlay.ts` turn this
 * into the debug overlay, so this slice has no `build.ts`.
 */

import { warn } from '../../../logger';
import {
  parsePackedInt32Arrays,
  parsePackedVector3Array,
} from '../../shapes/packedArray';
import { drawableNavigationPolygons } from '../polygonIndices';
import type { NavigationMeshData } from './types';

const FLOATS_PER_VERTEX = 3;

/**
 * Decode a NavigationMesh's properties, or null when it describes nothing
 * drawable — absent, empty, unreadable, or without one surviving polygon. Never
 * throws: a malformed value degrades to null so a render pass cannot fault on it.
 */
export function decodeNavigationMesh(
  properties: Record<string, unknown>
): NavigationMeshData | null {
  // `Record<string, unknown>` serves both arrival paths unchanged: a
  // ParsedResource's `properties` and an inline `[sub_resource]`'s `data`. A
  // non-string value is not a Godot-text literal, so it decodes to nothing.
  const verticesLiteral = properties['vertices'];
  const polygonsLiteral = properties['polygons'];
  if (typeof verticesLiteral !== 'string' || typeof polygonsLiteral !== 'string') return null;
  if (!verticesLiteral || !polygonsLiteral) return null;

  let flat: Float32Array;
  try {
    flat = parsePackedVector3Array(verticesLiteral);
  } catch {
    warn(`[NavigationMesh] Unreadable vertices, no navmesh drawn: ${verticesLiteral}`);
    return null;
  }

  const vertexCount = Math.floor(flat.length / FLOATS_PER_VERTEX);
  if (vertexCount === 0) return null;
  // A trailing partial vertex would leave the position buffer's item count
  // fractional; drop it instead of handing THREE a ragged array.
  const vertices =
    flat.length === vertexCount * FLOATS_PER_VERTEX
      ? flat
      : flat.slice(0, vertexCount * FLOATS_PER_VERTEX);

  let indexLists: number[][];
  try {
    indexLists = parsePackedInt32Arrays(polygonsLiteral);
  } catch {
    warn(`[NavigationMesh] Unreadable polygons, no navmesh drawn: ${polygonsLiteral}`);
    return null;
  }

  const polygons = drawableNavigationPolygons(indexLists, vertexCount);
  if (polygons.length === 0) return null;

  return { vertices, polygons };
}
