/**
 * A render target that takes a pass's output as the drawing buffer does: three tonemaps and encodes
 * into a target only when it is flagged `isXRRenderTarget`, and then takes the output space from
 * `texture.colorSpace` (`WebGLPrograms.js`).
 */

import type * as THREE from 'three';

/** Not declared by @types/three: three sets the flag on plain render targets the same way (`XRManager.js`). */
export function takeOutputLikeDrawingBuffer(target: THREE.WebGLRenderTarget): void {
  (target as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
}

export function takesOutputLikeDrawingBuffer(target: THREE.WebGLRenderTarget): boolean {
  return (target as THREE.WebGLRenderTarget & { isXRRenderTarget?: boolean }).isXRRenderTarget === true;
}
