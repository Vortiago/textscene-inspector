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

/** The float a slot takes from `value`, or null for an absent key and for a value the slot refuses. */
function writtenReal(value: string | undefined): number | null {
  return value === undefined ? null : scalarSlotValue(value);
}

/** As {@link writtenReal}, but a non-finite value is null: the renderer falls back where the linter reports. */
function writtenFiniteReal(value: string | undefined): number | null {
  const real = writtenReal(value);
  return real !== null && Number.isFinite(real) ? real : null;
}

/**
 * The range `stem` holds after the writes that `read` accepts apply in the file's order, on a pair
 * that Godot constructs at `fallback` for both bounds.
 */
function settledParamRange(
  properties: Record<string, string>,
  stem: string,
  fallback: number,
  read: (value: string | undefined) => number | null
): { min: number; max: number } {
  const minKey = `${stem}_min`;
  const maxKey = `${stem}_max`;
  const writtenMin = read(properties[minKey]);
  const writtenMax = read(properties[maxKey]);
  let min = fallback;
  let max = fallback;
  const setMin = (value: number) => {
    min = storedReal(value);
    if (min > max) max = min;
  };
  const setMax = (value: number) => {
    max = storedReal(value);
    if (min > max) min = max;
  };

  // The file's order matters only when both keys are written, and then the scan is for this pair alone.
  const isMaxFirst =
    writtenMin !== null &&
    writtenMax !== null &&
    !replayPositions(properties, minKey, [maxKey])[maxKey]!.late;
  if (isMaxFirst) setMax(writtenMax);
  if (writtenMin !== null) setMin(writtenMin);
  if (writtenMax !== null && !isMaxFirst) setMax(writtenMax);
  return { min, max };
}

/**
 * The range `stem` holds after the file's lines apply, on a pair that Godot constructs at
 * `fallback` for both bounds. A write that crosses the other bound moves it, so a lone
 * `scale_amount_min = 3` on a default of 1 loads as 3 and 3. A value the slot does not take, and a
 * non-finite one, is skipped, and the lint validator reports it.
 */
export function loadedParamRange(
  properties: Record<string, string>,
  stem: string,
  fallback: number
): { min: number; max: number } {
  return settledParamRange(properties, stem, fallback, writtenFiniteReal);
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
    const writtenMin = writtenReal(properties[minKey]);
    const writtenMax = writtenReal(properties[maxKey]);
    if (writtenMin === null || writtenMax === null) continue;
    const min = storedReal(writtenMin);
    const max = storedReal(writtenMax);
    if (!(min > max)) continue;

    const loaded = settledParamRange(properties, stem, min, writtenReal);
    const isMinMoved = loaded.min !== min;
    crossed.push({
      minKey,
      maxKey,
      min,
      max,
      movedKey: isMinMoved ? minKey : maxKey,
      loadedValue: isMinMoved ? loaded.min : loaded.max,
    });
  }
  return crossed;
}
