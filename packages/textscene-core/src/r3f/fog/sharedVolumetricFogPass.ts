/** The volumetric fog pass one renderer shares between every scene it draws with fog. */

import type * as THREE from 'three';
import { VolumetricFogPass } from './volumetricFogPass.js';

/** Written only by `acquireVolumetricFogPass` and the release it returns. */
// eslint-disable-next-line no-restricted-syntax -- the entry counts its users, and the last release deletes it
const shared = new WeakMap<THREE.WebGLRenderer, { pass: VolumetricFogPass; users: number }>();

/**
 * The renderer's volumetric fog pass. Every fog program reads one volume, so the scenes one renderer
 * draws share the pass, each preparing it before its own render. The last release disposes it.
 */
export function acquireVolumetricFogPass(renderer: THREE.WebGLRenderer): {
  pass: VolumetricFogPass;
  release: () => void;
} {
  const entry = shared.get(renderer) ?? { pass: new VolumetricFogPass(), users: 0 };
  shared.set(renderer, entry);
  entry.users++;
  let isReleased = false;
  return {
    pass: entry.pass,
    release: () => {
      if (isReleased) return;
      isReleased = true;
      entry.users--;
      if (entry.users > 0) return;
      entry.pass.dispose();
      shared.delete(renderer);
    },
  };
}
