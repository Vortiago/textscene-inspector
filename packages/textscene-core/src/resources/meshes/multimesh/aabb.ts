/** A MultiMesh's box as `multimesh_get_aabb` returns it (`mesh_storage.cpp:2233-2245`). No THREE. */

import { EMPTY_AABB, mergeAabb, transformAabb, type Aabb } from '../../../godot/aabb.js';
import { TRANSFORM_FLOATS, type MultiMeshData } from './types.js';

/**
 * The box of `multiMesh`, whose mesh has the box `meshAabb`: its custom box, else its mesh's box under
 * each bounded transform, merged. Null while the mesh's box is unknown and the result needs it.
 */
export function multiMeshAabb(multiMesh: MultiMeshData, meshAabb: Aabb | null): Aabb | null {
  if (multiMesh.customAabb) return multiMesh.customAabb;
  const transforms = multiMesh.boundedTransforms;
  if (transforms.length === 0) return EMPTY_AABB;
  if (!meshAabb) return null;
  let merged = transformAabb(transforms.subarray(0, TRANSFORM_FLOATS), meshAabb);
  for (let at = TRANSFORM_FLOATS; at < transforms.length; at += TRANSFORM_FLOATS) {
    merged = mergeAabb(merged, transformAabb(transforms.subarray(at, at + TRANSFORM_FLOATS), meshAabb));
  }
  return merged;
}
