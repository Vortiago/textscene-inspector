/**
 * The CPUParticles2D range bounds the previewer cannot draw: a bound that is non-finite once stored
 * as a `real_t`. The parser skips them, so the range keeps its default, and the linter names them.
 */

import { CPU_PARTICLES_PARAMS } from '../../../godot/scene/cpuParticles.js';
import { storedReal } from '../../../godot/math/real.js';
import { writtenScalarSlotValue } from '../../../godot/variant/variantBool.js';

/** A `_min` or `_max` key the file writes as a non-finite `real_t`, and the value it stores. */
export interface NonFiniteBound {
  readonly key: string;
  readonly stored: number;
}

/** Every `_min` and `_max` key, built once: each CPUParticles2D parse reads them all. */
const PARAM_BOUND_KEYS: readonly string[] = CPU_PARTICLES_PARAMS.flatMap((stem) => [
  `${stem}_min`,
  `${stem}_max`,
]);

/**
 * `properties` without its non-finite bounds, in the order the file lists the rest, and those
 * bounds. The stored form is tested, since `1e39` is finite as a double and inf as a `real_t`. With
 * every bound finite, `drawable` is `properties` itself.
 */
export function drawableParamBounds(properties: Record<string, string>): {
  drawable: Record<string, string>;
  nonFinite: NonFiniteBound[];
} {
  const nonFinite = nonFiniteBounds(properties);
  if (nonFinite.length === 0) return { drawable: properties, nonFinite };
  const skipped = new Set(nonFinite.map(({ key }) => key));
  return {
    drawable: Object.fromEntries(Object.entries(properties).filter(([key]) => !skipped.has(key))),
    nonFinite,
  };
}

function nonFiniteBounds(properties: Record<string, string>): NonFiniteBound[] {
  const nonFinite: NonFiniteBound[] = [];
  for (const key of PARAM_BOUND_KEYS) {
    const written = writtenScalarSlotValue(properties[key]);
    if (written === undefined) continue;
    const stored = storedReal(written);
    if (!Number.isFinite(stored)) nonFinite.push({ key, stored });
  }
  return nonFinite;
}
