/**
 * Runs a frame or a call with the renderer's bind and draw entry points replaced by recorders. The
 * fake WebGL context's `setRenderTarget` throws "invalid value used as weak map key" as an
 * unhandled rejection, so the code under test exercises only the state around the GL side.
 */
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';

interface GlRecorders {
  /** Called for every `setRenderTarget`, the restoring null bind included. */
  onBind?: (target: THREE.WebGLRenderTarget | null) => void;
  /** Called for every `render`, with the target bound at that moment and what is drawn. */
  onRender?: (bound: THREE.WebGLRenderTarget | null, scene: THREE.Object3D, camera: THREE.Camera) => void;
}

/** Runs `run` with the recorders in place, and restores the renderer after it settles. */
export async function withStubbedGl(
  gl: THREE.WebGLRenderer,
  { onBind, onRender }: GlRecorders,
  run: () => unknown
): Promise<void> {
  let bound: THREE.WebGLRenderTarget | null = null;
  const original = { set: gl.setRenderTarget, get: gl.getRenderTarget, render: gl.render };
  gl.setRenderTarget = ((target: THREE.WebGLRenderTarget | null) => {
    bound = target;
    onBind?.(target);
  }) as typeof gl.setRenderTarget;
  gl.getRenderTarget = () => bound;
  gl.render = ((scene: THREE.Object3D, camera: THREE.Camera) =>
    onRender?.(bound, scene, camera)) as typeof gl.render;
  try {
    await run();
  } finally {
    gl.setRenderTarget = original.set;
    gl.getRenderTarget = original.get;
    gl.render = original.render;
  }
}

/** Runs one frame of `renderer` under `withStubbedGl`. */
export function advanceFrameWithStubbedGl(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  gl: THREE.WebGLRenderer,
  onBind?: (target: THREE.WebGLRenderTarget | null) => void
): Promise<void> {
  return withStubbedGl(gl, { onBind }, () => renderer.advanceFrames(1, 16));
}
