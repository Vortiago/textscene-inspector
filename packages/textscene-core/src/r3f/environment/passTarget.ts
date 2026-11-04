/**
 * The render target of a full-screen pass: one texel without depth, which the caller sizes.
 */

import * as THREE from 'three';

/**
 * The options of a pass's own target that a shader reads only at whole texels: no depth, no mips,
 * nearest filtering. A target read through a linear sampler sets its own filters over these.
 *
 * @canonical Render target options for a pass read at whole texels
 */
export const NEAREST_TARGET: Readonly<THREE.RenderTargetOptions> = {
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
};

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
