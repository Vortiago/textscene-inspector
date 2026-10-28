/** The fog passes one renderer shares between every scene it draws with fog. */

import type * as THREE from 'three';
import { FogRadiancePass } from './fogRadiancePass.js';
import { VolumetricFogPass } from './volumetricFogPass.js';

export interface FogPasses {
  volume: VolumetricFogPass;
  radiance: FogRadiancePass;
}

/** Written only by `acquireFogPasses` and the release it returns. */
// eslint-disable-next-line no-restricted-syntax -- the entry counts its users, and the last release deletes it
const shared = new WeakMap<THREE.WebGLRenderer, { passes: FogPasses; users: number }>();

/**
 * The renderer's fog passes. Every fog program reads one volume and one radiance atlas, so the
 * scenes one renderer draws share the passes, each preparing them before its own render. The last
 * release disposes them.
 */
export function acquireFogPasses(renderer: THREE.WebGLRenderer): { passes: FogPasses; release: () => void } {
  const entry = shared.get(renderer) ?? {
    passes: { volume: new VolumetricFogPass(), radiance: new FogRadiancePass() },
    users: 0,
  };
  shared.set(renderer, entry);
  entry.users++;
  let isReleased = false;
  return {
    passes: entry.passes,
    release: () => {
      if (isReleased) return;
      isReleased = true;
      entry.users--;
      if (entry.users > 0) return;
      entry.passes.volume.dispose();
      entry.passes.radiance.dispose();
      shared.delete(renderer);
    },
  };
}
