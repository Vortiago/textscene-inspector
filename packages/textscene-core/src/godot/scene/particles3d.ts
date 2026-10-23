/**
 * Godot 4.6.3's CPUParticles3D, GPUParticles3D and ParticleProcessMaterial facts a scene's
 * properties carry, except where a table names its newer source (ADR-0032: the newer release wins
 * where the two differ).
 */

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

/**
 * `CPUParticles3D::EmissionShape` (`cpu_particles_3d.h:73-82`), which `ParticleProcessMaterial`
 * declares alike (`particle_process_material.h:82-89`), `EMISSION_SHAPE_MAX` left out.
 */
export const EmissionShape = {
  POINT: 0,
  SPHERE: 1,
  SPHERE_SURFACE: 2,
  BOX: 3,
  POINTS: 4,
  DIRECTED_POINTS: 5,
  RING: 6,
} as const;

/** Each emission shape by its integer, spelled as its constant. */
export const PARTICLE_EMISSION_SHAPE_NAMES = enumNamesByValue(EmissionShape);

/**
 * `ParticleProcessMaterial::SubEmitterMode` (`particle_process_material.h:93-100`),
 * `SUB_EMITTER_MAX` left out. The hint lists `At Start:4` before `At End:2`
 * (`particle_process_material.cpp:2312`), and the integers follow this declaration.
 */
const SubEmitterMode = {
  DISABLED: 0,
  CONSTANT: 1,
  AT_END: 2,
  AT_COLLISION: 3,
  AT_START: 4,
} as const;

/** Each sub-emitter mode by its integer, spelled as its constant. */
export const PARTICLE_SUB_EMITTER_MODE_NAMES = enumNamesByValue(SubEmitterMode);

/** `ParticleProcessMaterial::CollisionMode` (`particle_process_material.h:103-108`), `COLLISION_MAX` left out. */
const CollisionMode = {
  DISABLED: 0,
  RIGID: 1,
  HIDE_ON_CONTACT: 2,
} as const;

/** Each collision mode by its integer, spelled as its constant. */
export const PARTICLE_COLLISION_MODE_NAMES = enumNamesByValue(CollisionMode);

/**
 * `GPUParticles3D::TransformAlign` from Godot 4.7.2 (`scene/3d/gpu_particles_3d.h:50-56`, bound at
 * `gpu_particles_3d.cpp:924-928`). Godot 4.6.3 declares the first four (`gpu_particles_3d.h:48-53`)
 * and refuses the rest with `ERR_FAIL_INDEX(uint32_t(p_align), 4)` (`gpu_particles_3d.cpp:630`);
 * 4.7.2 assigns bare, so a scene that stores `LOCAL_BILLBOARD` loads.
 */
const GpuTransformAlign = {
  DISABLED: 0,
  Z_BILLBOARD: 1,
  Y_TO_VELOCITY: 2,
  Z_BILLBOARD_Y_TO_VELOCITY: 3,
  LOCAL_BILLBOARD: 4,
} as const;

/** Each transform alignment by its integer, spelled as its constant. */
export const GPU_PARTICLES_3D_TRANSFORM_ALIGN_NAMES = enumNamesByValue(GpuTransformAlign);

/**
 * The emission keys of a new `CPUParticles3D` (`cpu_particles_3d.cpp:1810-1817`) and a new
 * `ParticleProcessMaterial` (`particle_process_material.cpp:2405-2414`), which agree. The offset
 * and the scale belong to the material alone.
 */
export const PARTICLE_EMISSION_DEFAULTS = Object.freeze({
  shape: EmissionShape.POINT as number,
  sphereRadius: 1,
  boxExtents: Object.freeze({ x: 1, y: 1, z: 1 }),
  ringAxis: Object.freeze({ x: 0, y: 0, z: 1 }),
  ringHeight: 1,
  ringRadius: 1,
  ringInnerRadius: 0,
  ringConeAngle: 90,
  shapeOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  shapeScale: Object.freeze({ x: 1, y: 1, z: 1 }),
});

/**
 * The serialised stem of each `ParticleProcessMaterial::Parameter` that has a `_min` and a `_max`
 * key, in enum order (`particle_process_material.h:49-68`). `PARAM_TURB_INFLUENCE_OVER_LIFE` has a
 * curve alone, and `PARAM_SCALE` serialises as `scale`.
 */
export const PARTICLE_PROCESS_MATERIAL_PARAMS = [
  'initial_velocity',
  'angular_velocity',
  'orbit_velocity',
  'linear_accel',
  'radial_accel',
  'tangential_accel',
  'damping',
  'angle',
  'scale',
  'hue_variation',
  'anim_speed',
  'anim_offset',
  'turbulence_influence',
  'turbulence_initial_displacement',
  'radial_velocity',
  'directional_velocity',
  'scale_over_velocity',
] as const;
