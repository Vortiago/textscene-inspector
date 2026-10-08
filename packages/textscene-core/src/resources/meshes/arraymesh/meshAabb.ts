/**
 * An ArrayMesh's box as the rendering server holds it: its `custom_aabb`, or else the merge of its
 * surfaces' stored `aabb` (`mesh.cpp:1696-1704`, `mesh_storage.cpp:705-712`).
 */

import { parseOptionalAabb } from '../../../parser/valueParsers.js';
import { EMPTY_AABB, isEmptyAabb, mergeAabb, type Aabb } from '../../../godot/aabb.js';
import { iterateSurfaceBlocks, readAabb } from './surfaceFields.js';

/** The box of the ArrayMesh whose properties are `properties`. A mesh with no surfaces is `AABB()`. */
export function arrayMeshAabb(properties: Readonly<Record<string, string>>): Aabb {
  const custom = parseOptionalAabb(properties['custom_aabb'], 'custom_aabb');
  if (custom && !isEmptyAabb(custom)) return custom;
  const surfacesRaw = properties['_surfaces'];
  if (!surfacesRaw) return EMPTY_AABB;
  let merged: Aabb | null = null;
  for (const block of iterateSurfaceBlocks(surfacesRaw)) {
    const surface = surfaceAabb(block);
    merged = merged ? mergeAabb(merged, surface) : surface;
  }
  return merged ?? EMPTY_AABB;
}

/** A surface's stored `aabb`, or `AABB()` where it stores none (`mesh.cpp:1609`). */
function surfaceAabb(block: string): Aabb {
  const stored = readAabb(block);
  if (!stored) return EMPTY_AABB;
  const [px, py, pz] = stored.position;
  const [sx, sy, sz] = stored.size;
  return { position: { x: px, y: py, z: pz }, size: { x: sx, y: sy, z: sz } };
}
