/** Draws into render targets of a pass's own and leaves the renderer as the caller had it. */

import type * as THREE from 'three';

/**
 * Runs `draw` with `autoClear` off, then restores the target, its cube face or layer, its mip level
 * and `autoClear`, even when `draw` throws: a renderer left on a pass's target would draw the next
 * frame into it.
 */
export function drawOffscreen(renderer: THREE.WebGLRenderer, draw: () => void): void {
  const target = renderer.getRenderTarget();
  const layer = renderer.getActiveCubeFace();
  const mipmapLevel = renderer.getActiveMipmapLevel();
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  try {
    draw();
  } finally {
    renderer.autoClear = autoClear;
    renderer.setRenderTarget(target, layer, mipmapLevel);
  }
}
