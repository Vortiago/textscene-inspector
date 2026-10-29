/**
 * The render state of a CPUParticles3D: its GeometryInstance3D state, what its box reads, its
 * emission and what its simulation reads. Every default is the one Godot's constructor or header
 * installs (`cpu_particles_3d.h:135-193`, `cpu_particles_3d.cpp:1773-1825`).
 */

import type { Aabb } from '../../../../godot/math/aabb';
import type { Rgba } from '../../../../godot/math/math';
import type { Vector3 } from '../../../../godot/math/vector';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';
import type { CPUParticles3DDrawOrder } from '../../../../godot/scene/particles3d';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';
import type { ParticleParam } from '../../../shared/cpuparticles/params';
import type { GeometryInstance3DProperties } from '../../geometryinstance3d/types';

export interface CPUParticles3DProperties extends GeometryInstance3DProperties {
  /**
   * `visibility_aabb`, which sets the multimesh's custom box (`cpu_particles_3d.cpp:113`). Null
   * for none, or for `AABB()`, which clears it (`mesh_storage.cpp:2236`).
   */
  visibilityAabb: Aabb | null;
  /** The raw `mesh` reference each particle draws, or undefined for none. */
  mesh: string | undefined;
  /** Whether `mesh` holds a mesh, which the multimesh box measures (`mesh_storage.cpp:1832`). */
  hasMesh: boolean;
  /** The emission shape and its sizes, which the editor gizmo draws and the simulation emits from. */
  emission: ParticleEmission;
  simulation: CPUParticles3DSimulation;
}

/** What `_particles_process` and `_update_particle_data_buffer` read. */
export interface CPUParticles3DSimulation {
  emitting: boolean;
  amount: number;
  /** Seconds, a `double` in Godot. */
  lifetime: number;
  oneShot: boolean;
  /** `preprocess`: seconds Godot spends before the first frame. A `double`. */
  preprocess: number;
  explosiveness: number;
  randomness: number;
  useFixedSeed: boolean;
  seed: number;
  /** A `double` in Godot. */
  lifetimeRandomness: number;
  /** Simulation rate. 0 means Godot's 30 Hz settle. */
  fixedFps: number;
  /** A `double` in Godot. The settle runs at 1, so only a `fixed_fps` emitter's first drawn step reads it. */
  speedScale: number;
  fractDelta: boolean;
  localCoords: boolean;
  drawOrder: EnumValue<typeof CPUParticles3DDrawOrder>;
  /** `emission_points`, as flat floats, three per point. */
  emissionPoints: Float32Array;
  /** `emission_normals`, as flat floats, three per normal. */
  emissionNormals: Float32Array;
  /** `emission_colors`, as flat floats, four per colour. */
  emissionColors: Float32Array;
  alignY: boolean;
  rotateY: boolean;
  disableZ: boolean;
  direction: Vector3;
  /** Degrees either side of `direction`. */
  spread: number;
  flatness: number;
  gravity: Vector3;
  /** Indexed by `CPUParticlesParameter`. Always `CPU_PARTICLES_PARAM_COUNT` long. */
  params: ParticleParam[];
  splitScale: boolean;
  /** The raw `scale_curve_x`, `_y` and `_z` references, read only with `splitScale`. */
  scaleCurves: { x: string | undefined; y: string | undefined; z: string | undefined };
  color: Rgba;
  /** The raw `Gradient` reference sampled over each particle's age. */
  colorRamp: string | undefined;
  /** The raw `Gradient` reference sampled once at each particle's birth. */
  colorInitialRamp: string | undefined;
}
