import type * as THREE from 'three';

/** The size of the target `renderer` draws into now: its render target, or the drawing buffer. */
export function renderTargetSize(renderer: THREE.WebGLRenderer, size: THREE.Vector2): THREE.Vector2 {
  const target = renderer.getRenderTarget();
  return target ? size.set(target.width, target.height) : renderer.getDrawingBufferSize(size);
}
