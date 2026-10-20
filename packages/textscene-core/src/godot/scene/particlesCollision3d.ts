/** Godot 4.6.3's GPUParticlesCollisionSDF3D and GPUParticlesCollisionHeightField3D facts a scene's properties carry. */

import { enumNamesByValue, relabelEnumNames } from '../classdb/enumNames.js';

/** `GPUParticlesCollisionSDF3D::Resolution` without `RESOLUTION_MAX` (`scene/3d/gpu_particles_collision_3d.h:99-107`). */
const SdfResolution = {
  RESOLUTION_16: 0,
  RESOLUTION_32: 1,
  RESOLUTION_64: 2,
  RESOLUTION_128: 3,
  RESOLUTION_256: 4,
  RESOLUTION_512: 5,
} as const;

/** `GPUParticlesCollisionHeightField3D::Resolution` without `RESOLUTION_MAX` (`gpu_particles_collision_3d.h:211-219`). */
const HeightFieldResolution = {
  RESOLUTION_256: 0,
  RESOLUTION_512: 1,
  RESOLUTION_1024: 2,
  RESOLUTION_2048: 3,
  RESOLUTION_4096: 4,
  RESOLUTION_8192: 5,
} as const;

/** `GPUParticlesCollisionHeightField3D::UpdateMode` (`gpu_particles_collision_3d.h:221-224`). */
const HeightFieldUpdateMode = {
  WHEN_MOVED: 0,
  ALWAYS: 1,
} as const;

/** A `RESOLUTION_256` member as the texel count the hint string prints, `256`. */
function texelCount(name: string): string {
  return name.replace('RESOLUTION_', '');
}

/** Each SDF resolution by its integer, spelled as its texel count (`gpu_particles_collision_3d.cpp:555`). */
export const GPU_PARTICLES_COLLISION_SDF_3D_RESOLUTION_NAMES = relabelEnumNames(
  enumNamesByValue(SdfResolution),
  texelCount
);

/** Each height field resolution by its integer, spelled as its texel count (`gpu_particles_collision_3d.cpp:734`). */
export const GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_RESOLUTION_NAMES = relabelEnumNames(
  enumNamesByValue(HeightFieldResolution),
  texelCount
);

/** Each update mode by its integer, spelled as its constant without `UPDATE_MODE_` (`gpu_particles_collision_3d.cpp:735`). */
export const GPU_PARTICLES_COLLISION_HEIGHT_FIELD_3D_UPDATE_MODE_NAMES =
  enumNamesByValue(HeightFieldUpdateMode);
