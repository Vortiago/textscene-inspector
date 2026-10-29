/**
 * The box a CPUParticles3D gives its instance: its multimesh's (`renderer_scene_cull.cpp:2000`).
 * A `visibility_aabb` sets it (`cpu_particles_3d.cpp:113`, `mesh_storage.cpp:2236`), and with no
 * mesh it stays `AABB()` (`mesh_storage.cpp:1832`). Otherwise it bounds the mesh under every
 * particle's transform, a never-born particle's zero transform too.
 */

import { EMPTY_AABB, type Aabb } from '../../../../godot/math/aabb';
import { multiMeshAabb } from '../../../../resources/meshes/multimesh/aabb';
import { particleTransforms } from './simulate';
import type { CPUParticles3DProperties } from './types';

/** The box in node space for the particle `buffer`, or null while the mesh's box is unknown. */
export function particlesAabb(
  { visibilityAabb, mesh, hasMesh }: CPUParticles3DProperties,
  buffer: Float32Array,
  meshAabb: Aabb | null
): Aabb | null {
  if (visibilityAabb) return visibilityAabb;
  if (!hasMesh) return EMPTY_AABB;
  return multiMeshAabb({ customAabb: null, mesh, boundedTransforms: particleTransforms(buffer) }, meshAabb);
}
