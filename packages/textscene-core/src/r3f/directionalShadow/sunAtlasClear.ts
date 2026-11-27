import type * as THREE from 'three';
import { holdsDirectionalShadowAtlas } from './shadowAtlas.js';

// three clears a map before each light (r187 `WebGLShadowMap.js:340-341`): a later sun would erase the first.
/** Runs `draw` with only its first clear of the sun atlas, which clears the whole atlas. */
export function clearSunAtlasOnce(renderer: THREE.WebGLRenderer, draw: () => void): void {
  const clear = renderer.clear;
  let isCleared = false;
  renderer.clear = (color, depth, stencil) => {
    if (holdsDirectionalShadowAtlas(renderer.getRenderTarget())) {
      if (isCleared) return;
      isCleared = true;
    }
    clear.call(renderer, color, depth, stencil);
  };
  try {
    draw();
  } finally {
    renderer.clear = clear;
  }
}
