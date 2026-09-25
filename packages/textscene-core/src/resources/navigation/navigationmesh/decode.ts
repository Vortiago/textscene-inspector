/**
 * NavigationMesh decode: `vertices = PackedVector3Array(x, y, z, …)` and
 * `polygons = [PackedInt32Array(i, …), …]`, the two internal properties that hold
 * the walkable surface (`scene/resources/navigation_mesh.cpp:572-573`). The rest
 * are bake settings. No THREE: `r3f/navigationOverlay.ts` builds the overlay.
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
 * drawable: absent, empty, unreadable, or without one surviving polygon. Never
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
  // fractional, so it is dropped rather than hand THREE a ragged array.
  const vertices =
    flat.length === vertexCount * FLOATS_PER_VERTEX
      ? flat
      : flat.slice(0, vertexCount * FLOATS_PER_VERTEX);

  let indexLists: number[][];
  try {
    // `_get_polygons` returns a plain `Array`, so Godot prints the bare wrapper
    // (`navigation_mesh.cpp:326-335`). The shared reader also takes the typed
    // `Array[PackedInt32Array](…)` the 2D sibling prints.
    indexLists = parsePackedInt32Arrays(polygonsLiteral);
  } catch {
    warn(`[NavigationMesh] Unreadable polygons, no navmesh drawn: ${polygonsLiteral}`);
    return null;
  }

  const polygons = drawableNavigationPolygons(indexLists, vertexCount);
  if (polygons.length === 0) return null;

  return { vertices, polygons };
}
