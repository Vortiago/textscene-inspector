/**
 * The paired `_min`/`_max` setters of CPUParticles2D, CPUParticles3D and ParticleProcessMaterial,
 * which pull one bound onto the other when a write crosses them (`cpu_particles_2d.cpp:352-376`,
 * `cpu_particles_3d.cpp:289-316`, `particle_process_material.cpp:1295-1300, 1369-1375`). The
 * serialised stems of each class are the caller's.
 */

import { writtenScalarSlotValue } from '../variant/variantBool.js';
import { storedReal } from '../math/real.js';

/** A `_min` above its `_max`, and the bound Godot moves onto the other at load. */
export interface CrossedParamRange {
  readonly minKey: string;
  readonly maxKey: string;
  /** The stored `real_t` of each key as the file writes it. */
  readonly min: number;
  readonly max: number;
  /** The key the file lists first. It loads as the other key's value. */
  readonly movedKey: string;
}

/**
 * The range `stem` holds after the file's lines apply in the file's order, on a pair that Godot
 * constructs at `fallback` for both bounds. A write that crosses the other bound moves it, so a lone
 * `scale_amount_min = 3` on a default of 1 loads as 3 and 3. A value the slot does not take is
 * skipped. A non-finite one loads, as the setters test no bound for finite (`cpu_particles_2d.cpp:352-376`).
 */
export function loadedParamRange(
  properties: Record<string, string>,
  stem: string,
  fallback: number
): { min: number; max: number } {
  const minKey = `${stem}_min`;
  const maxKey = `${stem}_max`;
  let min = fallback;
  let max = fallback;
  // The record lists its keys in file order, so the writes apply in the order the file states them.
  for (const [key, value] of Object.entries(properties)) {
    if (key !== minKey && key !== maxKey) continue;
    const written = writtenScalarSlotValue(value);
    if (written === undefined) continue;
    if (key === minKey) {
      min = storedReal(written);
      if (min > max) max = min;
    } else {
      max = storedReal(written);
      if (min > max) min = max;
    }
  }
  return { min, max };
}

/**
 * Every pair of `stems` whose authored `_min` is above its authored `_max`. The key the file lists
 * first loads as the other key's value. One authored key alone moves only the default, so it never
 * appears here.
 */
export function crossedParamRanges(
  properties: Record<string, string>,
  stems: readonly string[]
): CrossedParamRange[] {
  const crossed: CrossedParamRange[] = [];
  for (const stem of stems) {
    const minKey = `${stem}_min`;
    const maxKey = `${stem}_max`;
    const writtenMin = writtenScalarSlotValue(properties[minKey]);
    const writtenMax = writtenScalarSlotValue(properties[maxKey]);
    if (writtenMin === undefined || writtenMax === undefined) continue;
    const min = storedReal(writtenMin);
    const max = storedReal(writtenMax);
    if (!(min > max)) continue;

    // The record lists its keys in file order. Only a crossed pair pays for the key list.
    const keys = Object.keys(properties);
    crossed.push({
      minKey,
      maxKey,
      min,
      max,
      movedKey: keys.indexOf(minKey) < keys.indexOf(maxKey) ? minKey : maxKey,
    });
  }
  return crossed;
}
