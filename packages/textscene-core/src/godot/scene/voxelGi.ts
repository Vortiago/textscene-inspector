/** Godot 4.6.3's VoxelGI facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';
import type { Vector3 } from '../math/vector.js';

/** `VoxelGI::Subdiv` (`scene/3d/voxel_gi.h:101-108`), `SUBDIV_MAX` left out. */
const Subdiv = {
  SUBDIV_64: 0,
  SUBDIV_128: 1,
  SUBDIV_256: 2,
  SUBDIV_512: 3,
} as const;

/** Each subdivision by its integer, spelled as its constant (`voxel_gi.cpp:575-578`). */
export const VOXEL_GI_SUBDIV_NAMES = enumNamesByValue(Subdiv);

/** `VoxelGI`'s defaults: `SUBDIV_128` and a size of 20 on each side (`voxel_gi.h:119-120`). */
export const VOXEL_GI_DEFAULTS = {
  size: { x: 20, y: 20, z: 20 },
  subdiv: Subdiv.SUBDIV_128,
} as const;

/** The cells along the longest side for each `Subdiv`, as the gizmo reads them (`voxel_gi_gizmo_plugin.cpp:107`). */
export const VOXEL_GI_SUBDIVISIONS = [64, 128, 256, 512] as const;

/** The `Subdiv` values `set_subdiv` keeps: it refuses any other (`voxel_gi.cpp:285-288`). */
export const VOXEL_GI_SUBDIV_VALUES: readonly number[] = Object.values(Subdiv);

/** `size.maxf(1.0)`: `set_size` raises each side to at least 1 (`voxel_gi.cpp:295-298`). */
export function voxelGiSize({ x, y, z }: Vector3): Vector3 {
  return { x: Math.max(1, x), y: Math.max(1, y), z: Math.max(1, z) };
}
