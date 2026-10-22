/**
 * The paired `_min`/`_max` setters of CPUParticles2D, CPUParticles3D and ParticleProcessMaterial,
 * which pull one bound onto the other when a write crosses them (`cpu_particles_2d.cpp:352-376`,
 * `cpu_particles_3d.cpp:289-316`, `particle_process_material.cpp:1295-1300, 1369-1375`). The
 * serialised stems of each class are the caller's.
 */

import { scalarSlotValue } from '../variant/variantBool.js';
import { storedReal } from '../math/real.js';
import { replayPositions } from './propertyReplay.js';

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
 * Every pair of `stems` whose authored `_min` is above its authored `_max`. `set_param_min` raises
 * the max to a min above it and `set_param_max` lowers the min to a max below it, in the order the
 * file lists the keys. One authored key alone moves only the default, so it never appears here.
 */
export function crossedParamRanges(
  properties: Record<string, string>,
  stems: readonly string[]
): CrossedParamRange[] {
  const crossed: CrossedParamRange[] = [];
  for (const stem of stems) {
    const minKey = `${stem}_min`;
    const maxKey = `${stem}_max`;
    const writtenMin = scalarSlotValue(properties[minKey] ?? '');
    const writtenMax = scalarSlotValue(properties[maxKey] ?? '');
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

/**
 * The range `stem` holds after the file's lines apply, on a pair that Godot constructs at
 * `fallback` for both bounds. A write that crosses the other bound moves it, so a lone
 * `scale_amount_min = 3` on a default of 1 loads as 3 and 3. A value the slot does not take is
 * skipped, and the lint validator reports it.
 */
export function loadedParamRange(
  properties: Record<string, string>,
  stem: string,
  fallback: number
): { min: number; max: number } {
  let min = fallback;
  let max = fallback;
  for (const [key, value] of Object.entries(properties)) {
    if (key !== `${stem}_min` && key !== `${stem}_max`) continue;
    const written = scalarSlotValue(value);
    if (written === null) continue;
    if (key === `${stem}_min`) {
      min = storedReal(written);
      if (min > max) max = min;
    } else {
      max = storedReal(written);
      if (min > max) min = max;
    }
  }
  return { min, max };
}
