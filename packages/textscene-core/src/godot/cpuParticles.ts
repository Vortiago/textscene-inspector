/**
 * The random-range parameters CPUParticles2D and CPUParticles3D share: their serialised
 * prefixes, and how the paired `_min`/`_max` setters resolve a crossed range at load.
 */

import { parseGodotFloat } from './number.js';
import { storedReal } from './real.js';
import { replayPositions } from './propertyReplay.js';

/**
 * The `Parameter` enum both classes declare alike (`cpu_particles_2d.h:48-62`,
 * `cpu_particles_3d.h:50-64`), in enum order, as the prefix each slot serialises its `_min`,
 * `_max` and `_curve` keys under. `PARAM_SCALE` serialises as `scale_amount`.
 */
export const CPU_PARTICLES_PARAMS = [
  'initial_velocity',
  'angular_velocity',
  'orbit_velocity',
  'linear_accel',
  'radial_accel',
  'tangential_accel',
  'damping',
  'angle',
  'scale_amount',
  'hue_variation',
  'anim_speed',
  'anim_offset',
] as const;

export type CpuParticlesParam = (typeof CPU_PARTICLES_PARAMS)[number];

const PARAM_KEY_PAIRS = CPU_PARTICLES_PARAMS.map((param) => [`${param}_min`, `${param}_max`] as const);

/** A `_min` above its `_max`, and the bound Godot moves onto the other at load. */
export interface CrossedParamRange {
  readonly minKey: string;
  readonly maxKey: string;
  /** The stored `real_t` of each key as the file writes it. */
  readonly min: number;
  readonly max: number;
  /** The key the file lists first. It loads as the other key's value. */
  readonly movedKey: string;
  readonly loadedValue: number;
}

/**
 * Every pair whose authored `_min` is above its authored `_max`. `set_param_min` raises the
 * max to a min above it and `set_param_max` lowers the min to a max below it
 * (`cpu_particles_2d.cpp:352-376`, `cpu_particles_3d.cpp:289-316`), in the order the file lists
 * the keys. One authored key alone moves only the default, so it never appears here.
 */
export function crossedParamRanges(properties: Record<string, string>): CrossedParamRange[] {
  const crossed: CrossedParamRange[] = [];
  for (const [minKey, maxKey] of PARAM_KEY_PAIRS) {
    const writtenMin = parseGodotFloat(properties[minKey] ?? '');
    const writtenMax = parseGodotFloat(properties[maxKey] ?? '');
    if (writtenMin === null || writtenMax === null) continue;
    const min = storedReal(writtenMin);
    const max = storedReal(writtenMax);
    if (!(min > max)) continue;

    const isMaxLater = replayPositions(properties, minKey, [maxKey])[maxKey]!.late;
    crossed.push(
      isMaxLater
        ? { minKey, maxKey, min, max, movedKey: minKey, loadedValue: max }
        : { minKey, maxKey, min, max, movedKey: maxKey, loadedValue: min }
    );
  }
  return crossed;
}
