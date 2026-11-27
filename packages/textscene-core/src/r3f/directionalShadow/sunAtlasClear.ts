import type * as THREE from 'three';
import { holdsDirectionalShadowAtlas } from './shadowAtlas.js';

// three clears a map before each light (r187 `WebGLShadowMap.js:340`): only a pass's first clear is whole.
/** Lets the first clear of the sun atlas after each `startPass` through, and skips the rest. */
export function clearSunAtlasOncePerPass(renderer: THREE.WebGLRenderer): () => void {
  const clear = renderer.clear;
  let isCleared = false;
  renderer.clear = (color, depth, stencil) => {
    if (holdsDirectionalShadowAtlas(renderer.getRenderTarget())) {
      if (isCleared) return;
      isCleared = true;
    }
    clear.call(renderer, color, depth, stencil);
  };
  return () => {
    isCleared = false;
  };
}
