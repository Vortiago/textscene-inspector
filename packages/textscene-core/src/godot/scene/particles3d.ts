/** Godot 4.6.3's CPUParticles3D and GPUParticles3D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `CPUParticles3D::DrawOrder` (`scene/3d/cpu_particles_3d.h:43-48`), `DRAW_ORDER_MAX` left out.
 * It has no `REVERSE_LIFETIME`, unlike {@link GPU_PARTICLES_3D_DRAW_ORDER_NAMES}.
 */
const CpuDrawOrder = {
  INDEX: 0,
  LIFETIME: 1,
  VIEW_DEPTH: 2,
} as const;

/** Each CPUParticles3D draw order by its integer, spelled as its constant. */
export const CPU_PARTICLES_3D_DRAW_ORDER_NAMES = enumNamesByValue(CpuDrawOrder);

/** `GPUParticles3D::DrawOrder` (`scene/3d/gpu_particles_3d.h:41-46`). */
const GpuDrawOrder = {
  INDEX: 0,
  LIFETIME: 1,
  REVERSE_LIFETIME: 2,
  VIEW_DEPTH: 3,
} as const;

/** Each GPUParticles3D draw order by its integer, spelled as its constant (`gpu_particles_3d.cpp:843` is the hint site, bound at `:857-860`). */
export const GPU_PARTICLES_3D_DRAW_ORDER_NAMES = enumNamesByValue(GpuDrawOrder);

/** `CPUParticles3D::EmissionShape` (`cpu_particles_3d.h:73-82`), `EMISSION_SHAPE_MAX` left out. */
const EmissionShape = {
  POINT: 0,
  SPHERE: 1,
  SPHERE_SURFACE: 2,
  BOX: 3,
  POINTS: 4,
  DIRECTED_POINTS: 5,
  RING: 6,
} as const;

/** Each emission shape by its integer, spelled as its constant. */
export const CPU_PARTICLES_3D_EMISSION_SHAPE_NAMES = enumNamesByValue(EmissionShape);
