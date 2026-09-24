/**
 * Whether anything `worldShadowCasters` reads has changed since the last look: the registry's
 * membership, and each caster's `is_visible_in_tree()` and world matrix. The flatten builds a new
 * `Float32Array` per occluder, so a still scene compares these inputs in a reused buffer instead,
 * as `useShadowLightPose` does for a light.
 */

import { visibleInTree, type ShadowCaster, type ShadowCasterRegistry } from './shadowCasterRegistry';

/** Per caster: the visibility flag, then the 16 world-matrix elements. */
const INPUTS_PER_CASTER = 17;

export interface CasterMotionWatch {
  /**
   * True on the first look, and whenever the flatten could differ from the one the last `true`
   * answered for. Refreshes each visible caster's world matrix, as the flatten does.
   */
  changed(registry: ShadowCasterRegistry): boolean;
}

export function createCasterMotionWatch(): CasterMotionWatch {
  // All three are written only by `changed`. The buffers grow with the caster count and are
  // never shrunk, so a still scene reads into memory it already holds.
  let seenVersion = -1;
  let seen = new Float64Array(0);
  let reading = new Float64Array(0);

  return {
    changed(registry) {
      const casters = registry.casters();
      const size = casters.length * INPUTS_PER_CASTER;
      if (reading.length < size) reading = new Float64Array(size);
      readCasterInputs(casters, reading);

      // One version is one snapshot, so an unmoved version also means an unchanged count.
      const version = registry.version();
      if (version === seenVersion && sameLeading(seen, reading, size)) return false;

      if (seen.length < size) seen = new Float64Array(size);
      for (let i = 0; i < size; i += 1) seen[i] = reading[i]!;
      seenVersion = version;
      return true;
    },
  };
}

function readCasterInputs(casters: readonly ShadowCaster[], out: Float64Array): void {
  for (let i = 0; i < casters.length; i += 1) {
    const { object } = casters[i]!;
    const at = i * INPUTS_PER_CASTER;
    // A hidden caster casts nothing whatever its matrix, so only its flag is recorded.
    if (!visibleInTree(object)) {
      out.fill(0, at, at + INPUTS_PER_CASTER);
      continue;
    }
    object.updateWorldMatrix(true, false);
    const elements = object.matrixWorld.elements;
    out[at] = 1;
    for (let j = 0; j < 16; j += 1) out[at + 1 + j] = elements[j]!;
  }
}

/** `!==`, as `sameWorldCasters` compares: a NaN input reads as moved every time. */
function sameLeading(a: Float64Array, b: Float64Array, size: number): boolean {
  for (let i = 0; i < size; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
