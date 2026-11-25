import { CPU_PARTICLES_PARAMS, PARAM_SLOTS } from '../../../godot/scene/cpuParticles.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { loadedParamRange } from '../../../godot/scene/particleParamRange.js';
import { packedOr, settableIntOr } from '../../../parser/valueParsers.js';
import { NO_FLOATS, parsePackedColorArray } from '../../../resources/shapes/packedArray.js';
import { drawableParamBounds } from './drawableParamBounds.js';

/** `PARAM_MAX`: the length of every parameter array. */
export const CPU_PARTICLES_PARAM_COUNT = CPU_PARTICLES_PARAMS.length;

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

/** The classes whose paired setters pull one bound onto the other as a file loads. */
const PARTICLE_CLASSES = ['CPUParticles2D', 'CPUParticles3D'];

/** Each `_min` and `_max` the file writes as its setters leave it, so a crossed pair loads as in Godot. */
export function withLoadedParamRanges(
  className: string,
  properties: Record<string, string>
): Record<string, string> {
  if (!PARTICLE_CLASSES.some((base) => descendsFromClass(className, base))) return properties;
  let loaded = properties;
  for (const { prefix, def } of PARAM_SLOTS) {
    const [minKey, maxKey] = [`${prefix}_min`, `${prefix}_max`];
    if (!Object.hasOwn(properties, minKey) && !Object.hasOwn(properties, maxKey)) continue;
    const { min, max } = loadedParamRange(properties, prefix, def);
    loaded = { ...loaded, [minKey]: realLiteral(min), [maxKey]: realLiteral(max) };
  }
  return loaded;
}

/** A number as Godot's text spells it: `String(Infinity)` gives `Infinity`, which `str_to_var` refuses. */
function realLiteral(real: number): string {
  if (Number.isNaN(real)) return 'nan';
  if (!Number.isFinite(real)) return real > 0 ? 'inf' : '-inf';
  return String(real);
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
 * The raw emission arrays. A parser reads each from its own properties, where the
 * property-grammar scan (`propertyGrammarParityScan.ts`) sees the read.
 */
export interface EmissionPointValues {
  emission_points: string | undefined;
  emission_normals: string | undefined;
  emission_colors: string | undefined;
}

/**
 * The emission arrays of a node whose points and normals `parseVectors` reads, a 2D or a 3D
 * `PackedVector*Array`. `at` names a key in a warning.
 */
export function parseEmissionPoints(
  values: EmissionPointValues,
  parseVectors: (value: string) => Float32Array,
  at: (key: string) => string
): EmissionPoints {
  const read = (key: keyof EmissionPointValues, parse: (value: string) => Float32Array) =>
    packedOr(values[key], parse, NO_FLOATS, at(key));
  return {
    points: read('emission_points', parseVectors),
    normals: read('emission_normals', parseVectors),
    colors: read('emission_colors', parsePackedColorArray),
  };
}
