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
  readonly loadedValue: number;
}

/**
 * As {@link writtenScalarSlotValue}, but undefined for a value that is non-finite once stored as a
 * `real_t`: the renderer cannot draw it. `1e39` is finite as a double and inf as a `real_t`.
 */
function writtenRealFiniteOnceStored(value: string | undefined): number | undefined {
  const written = writtenScalarSlotValue(value);
  return written !== undefined && Number.isFinite(storedReal(written)) ? written : undefined;
}

/**
 * The range `stem` holds after the writes that `read` accepts apply in the file's order, on a pair
 * that Godot constructs at `fallback` for both bounds.
 */
function settledParamRange(
  properties: Record<string, string>,
  stem: string,
  fallback: number,
  read: (value: string | undefined) => number | undefined
): { min: number; max: number } {
  const minKey = `${stem}_min`;
  const maxKey = `${stem}_max`;
  let min = fallback;
  let max = fallback;
  // The record lists its keys in file order, so the writes apply in the order the file states them.
  for (const [key, value] of Object.entries(properties)) {
    if (key !== minKey && key !== maxKey) continue;
    const written = read(value);
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
 * The range `stem` holds after the file's lines apply, on a pair that Godot constructs at
 * `fallback` for both bounds. A write that crosses the other bound moves it, so a lone
 * `scale_amount_min = 3` on a default of 1 loads as 3 and 3. A value the slot does not take is
 * skipped, and the lint validator reports it. A non-finite one is skipped too, and the linter
 * accepts it.
 */
export function loadedParamRange(
  properties: Record<string, string>,
  stem: string,
  fallback: number
): { min: number; max: number } {
  return settledParamRange(properties, stem, fallback, writtenRealFiniteOnceStored);
}

/** The keys of `stems` that the file writes as a non-finite real, which {@link loadedParamRange} skips. */
export function nonFiniteParamBounds(properties: Record<string, string>, stems: readonly string[]): string[] {
  return stems
    .flatMap((stem) => [`${stem}_min`, `${stem}_max`])
    .filter(
      (key) =>
        writtenScalarSlotValue(properties[key]) !== undefined &&
        writtenRealFiniteOnceStored(properties[key]) === undefined
    );
}

/** `properties` without the keys {@link nonFiniteParamBounds} names, in the order the file lists the rest. */
export function finiteParamBounds(
  properties: Record<string, string>,
  stems: readonly string[]
): Record<string, string> {
  const skipped = new Set(nonFiniteParamBounds(properties, stems));
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !skipped.has(key)));
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

    // A crossed pair settles on one value: the bound the file lists last.
    const loadedValue = settledParamRange(properties, stem, min, writtenScalarSlotValue).min;
    crossed.push({ minKey, maxKey, min, max, movedKey: loadedValue === min ? maxKey : minKey, loadedValue });
  }
  return crossed;
}
