/** A fake renderer's members that `renderToOffscreenTarget` saves and restores around its draw. */
import type * as THREE from 'three';

/** The clear and target state a fake renderer answers, at three's defaults. */
export function offscreenRendererState() {
  return {
    autoClear: true,
    autoClearColor: true,
    getClearColor: (out: THREE.Color) => out,
    getClearAlpha: () => 1,
    setClearColor: () => {},
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
  };
}
