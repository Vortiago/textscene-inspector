/**
 * The CPUParticles2D range bounds the previewer cannot draw: a bound that is non-finite once stored
 * as a `real_t`. The parser skips them, so the range keeps its default, and the linter names them.
 */

import { CPU_PARTICLES_PARAMS } from '../../../godot/scene/cpuParticles.js';
import { storedReal } from '../../../godot/math/real.js';
import { writtenScalarSlotValue } from '../../../godot/variant/variantBool.js';

/**
 * Whether the slot takes `value` and stores it as a non-finite `real_t`. The stored form is tested,
 * since `1e39` is finite as a double and inf as a `real_t`.
 */
function isNonFiniteOnceStored(value: string | undefined): boolean {
  const written = writtenScalarSlotValue(value);
  return written !== undefined && !Number.isFinite(storedReal(written));
}

/** The `_min` and `_max` keys the file writes as a non-finite `real_t`. */
export function nonFiniteParamBounds(properties: Record<string, string>): string[] {
  return CPU_PARTICLES_PARAMS.flatMap((stem) => [`${stem}_min`, `${stem}_max`]).filter((key) =>
    isNonFiniteOnceStored(properties[key])
  );
}

/** `properties` without the keys {@link nonFiniteParamBounds} names, in the order the file lists the rest. */
export function finiteParamBounds(properties: Record<string, string>): Record<string, string> {
  const skipped = new Set(nonFiniteParamBounds(properties));
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !skipped.has(key)));
}
