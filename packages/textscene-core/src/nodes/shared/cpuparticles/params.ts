/**
 * The random-range parameter slots CPUParticles2D and CPUParticles3D both declare: each slot's
 * serialised keys, its Godot default and its Inspector label, and the parse of a node's slots and
 * of its emission points.
 * Both constructors install the same defaults (`cpu_particles_2d.cpp:1698-1722`,
 * `cpu_particles_3d.cpp:1786-1809`).
 */

import { CPU_PARTICLES_PARAMS, type CpuParticlesParam } from '../../../godot/scene/cpuParticles.js';
import { loadedParamRange } from '../../../godot/scene/particleParamRange.js';
import { packedOr, settableIntOr } from '../../../parser/valueParsers.js';
import { NO_FLOATS, parsePackedColorArray } from '../../../resources/shapes/packedArray.js';
import { drawableParamBounds } from './drawableParamBounds.js';

/** `PARAM_MAX`: the length of every parameter array. */
export const CPU_PARTICLES_PARAM_COUNT = CPU_PARTICLES_PARAMS.length;

/** The Inspector label, the Godot default of `_min` and `_max`, and whether Godot exposes a curve. */
interface SlotDetails {
  label: string;
  def: number;
  curve: boolean;
}

const SLOT_DETAILS: Readonly<Record<CpuParticlesParam, SlotDetails>> = {
  initial_velocity: { label: 'Initial Velocity', def: 0, curve: false },
  angular_velocity: { label: 'Angular Velocity', def: 0, curve: true },
  orbit_velocity: { label: 'Orbit Velocity', def: 0, curve: true },
  linear_accel: { label: 'Linear Accel', def: 0, curve: true },
  radial_accel: { label: 'Radial Accel', def: 0, curve: true },
  tangential_accel: { label: 'Tangential Accel', def: 0, curve: true },
  damping: { label: 'Damping', def: 0, curve: true },
  angle: { label: 'Angle', def: 0, curve: true },
  scale_amount: { label: 'Scale Amount', def: 1, curve: true },
  hue_variation: { label: 'Hue Variation', def: 0, curve: true },
  anim_speed: { label: 'Anim Speed', def: 0, curve: true },
  anim_offset: { label: 'Anim Offset', def: 0, curve: true },
};

/**
 * The parameter slots, in `CPUParticlesParameter` order: the serialised prefix
 * (`<prefix>_min` / `_max` / `_curve`) and its {@link SLOT_DETAILS}. The parser applies
 * `def` and the formatter hides a slot that holds it, so one table keeps them agreed.
 */
export const PARAM_SLOTS: ReadonlyArray<{ prefix: CpuParticlesParam } & SlotDetails> =
  CPU_PARTICLES_PARAMS.map((prefix) => ({ prefix, ...SLOT_DETAILS[prefix] }));

/** One parameter slot: the random range plus the optional shaping curve. */
export interface ParticleParam {
  min: number;
  max: number;
  /**
   * Raw `SubResource("id")` reference to a `Curve`, resolved at render time.
   * `InitialLinearVelocity` has no serialised curve property in Godot, so its
   * slot is always absent.
   */
  curve?: string;
}

/**
 * Every slot as the scene loader leaves it, indexed by `CPUParticlesParameter`. A bound the
 * previewer cannot draw keeps its default (`drawableParamBounds`).
 */
export function parseParticleParams(properties: Record<string, string>): ParticleParam[] {
  const drawable = drawableParamBounds(properties).drawable;
  return PARAM_SLOTS.map(({ prefix, def, curve }) => {
    const param: ParticleParam = loadedParamRange(drawable, prefix, def);
    const ref = curve ? properties[`${prefix}_curve`] : undefined;
    if (ref) param.curve = ref;
    return param;
  });
}

/** The `amount` both constructors set (`cpu_particles_2d.cpp:1692`, `cpu_particles_3d.cpp:1781`). */
const DEFAULT_AMOUNT = 8;

/**
 * The top of the `amount` hint, `1,1000000,1,exp` (`cpu_particles_2d.cpp:1491`). The setter takes
 * more, and the previewer stops here, as every particle costs a simulation step and an instance.
 */
const MAX_PREVIEWED_AMOUNT = 1_000_000;

/** `amount` as the setter leaves it: it refuses a count below 1 (`cpu_particles_2d.cpp:68`, `cpu_particles_3d.cpp:72`). */
export function parseParticleAmount(value: string | undefined, context: string): number {
  return Math.min(MAX_PREVIEWED_AMOUNT, settableIntOr(value, DEFAULT_AMOUNT, { min: 1 }, context));
}

/** The flat `emission_points`, `emission_normals` and `emission_colors`, each empty when unset. */
export interface EmissionPoints {
  points: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
}

/**
 * The emission arrays of a node whose points and normals `parseVectors` reads, a 2D or a 3D
 * `PackedVector*Array`. `at` names a key in a warning.
 */
export function parseEmissionPoints(
  properties: Record<string, string>,
  parseVectors: (value: string) => Float32Array,
  at: (key: string) => string
): EmissionPoints {
  const read = (key: string, parse: (value: string) => Float32Array) =>
    packedOr(properties[key], parse, NO_FLOATS, at(key));
  return {
    points: read('emission_points', parseVectors),
    normals: read('emission_normals', parseVectors),
    colors: read('emission_colors', parsePackedColorArray),
  };
}
