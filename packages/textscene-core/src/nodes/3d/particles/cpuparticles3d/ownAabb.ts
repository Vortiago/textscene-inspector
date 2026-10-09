/**
 * The box a CPUParticles3D gives its instance: its multimesh's (`renderer_scene_cull.cpp:2000`).
 * A `visibility_aabb` sets it (`cpu_particles_3d.cpp:113`, `mesh_storage.cpp:2236`), and with no
 * mesh it stays `AABB()` (`mesh_storage.cpp:1832`). Otherwise it bounds the live particles, which
 * the previewer does not simulate, so it is unknown.
 */

import type { TscnNode } from '../../../../parser/types';
import { EMPTY_AABB, type Aabb } from '../../../../godot/aabb';
import type { CPUParticles3DProperties } from './types';

export function useCPUParticles3DAabb(node: TscnNode): Aabb | null {
  const { visibilityAabb, hasMesh } = node.properties as CPUParticles3DProperties;
  if (visibilityAabb) return visibilityAabb;
  return hasMesh ? null : EMPTY_AABB;
}
