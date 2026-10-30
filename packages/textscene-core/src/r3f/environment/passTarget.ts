/**
 * The render target of a full-screen pass: one texel without depth, which the caller sizes.
 */

import * as THREE from 'three';

type PassTargetOptions = Pick<THREE.RenderTargetOptions, 'type' | 'minFilter' | 'magFilter'>;

/**
 * Half float by default, so a bright pass that caps at 12 or a luminance above 1 stays in range.
 * `options` carries what a pass differs on: a level read with `texelFetch` wants Nearest, and the
 * luminance reduction wants the 32-bit float of Godot's R32F level.
 *
 * @canonical A render target for a full-screen pass
 */
export function createPassTarget(name: string, options: PassTargetOptions = {}): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    type: THREE.HalfFloatType,
    ...options,
  });
  target.texture.name = name;
  return target;
}
