/** Godot 4.6.3's CPUParticles2D and GPUParticles2D facts a scene's properties carry. */

import { enumNamesByValue, labelEnumNames } from '../classdb/enumNames.js';

/**
 * `CPUParticles2D::DrawOrder` (`scene/2d/cpu_particles_2d.h:43-46`). It has no `REVERSE_LIFETIME`,
 * unlike {@link GPU_PARTICLES_2D_DRAW_ORDER_NAMES}, despite the identical property name.
 */
export const CPUParticles2DDrawOrder = {
  INDEX: 0,
  LIFETIME: 1,
} as const;

/** Each CPUParticles2D draw order by its integer, spelled as its constant (`cpu_particles_2d.cpp:1509` is the hint site). */
export const CPU_PARTICLES_2D_DRAW_ORDER_NAMES = enumNamesByValue(CPUParticles2DDrawOrder);

/** Each CPUParticles2D draw order by its integer, in the labels the inspector hint prints (`cpu_particles_2d.cpp:1509`). */
export const CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES = labelEnumNames(CPUParticles2DDrawOrder, {
  INDEX: 'Index',
  LIFETIME: 'Lifetime',
});

/** `GPUParticles2D::DrawOrder` (`scene/2d/gpu_particles_2d.h:40-44`). */
const GpuDrawOrder = {
  INDEX: 0,
  LIFETIME: 1,
  REVERSE_LIFETIME: 2,
} as const;

/** Each GPUParticles2D draw order by its integer, spelled as its constant (`gpu_particles_2d.cpp:964` is the hint site). */
export const GPU_PARTICLES_2D_DRAW_ORDER_NAMES = enumNamesByValue(GpuDrawOrder);

/** `CPUParticles2D::EmissionShape` (`cpu_particles_2d.h:71-80`), `EMISSION_SHAPE_MAX` left out. */
export const CPUParticles2DEmissionShape = {
  POINT: 0,
  SPHERE: 1,
  SPHERE_SURFACE: 2,
  RECTANGLE: 3,
  POINTS: 4,
  DIRECTED_POINTS: 5,
  RING: 6,
} as const;

/** Each emission shape by its integer, spelled as its constant (`cpu_particles_2d.cpp:1586`). */
export const CPU_PARTICLES_2D_EMISSION_SHAPE_NAMES = enumNamesByValue(CPUParticles2DEmissionShape);

/** Each emission shape by its integer, in the labels the inspector hint prints (`cpu_particles_2d.cpp:1586`). */
export const CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES = labelEnumNames(CPUParticles2DEmissionShape, {
  POINT: 'Point',
  SPHERE: 'Sphere',
  SPHERE_SURFACE: 'Sphere Surface',
  RECTANGLE: 'Rectangle',
  POINTS: 'Points',
  DIRECTED_POINTS: 'Directed Points',
  RING: 'Ring',
});
