/**
 * Copies a texture's texels into a render target, one texel to each pixel, with no filter. A
 * placement maps each target pixel to a source texel, so one pass serves a whole copy, a crop and a
 * copy with its rows reversed. A transfer converts between the plain and the decoding view of a
 * sub-viewport target.
 */

import type * as THREE from 'three';
import { drawFullScreen, fullScreenPass } from './fullScreenPass';
import { perObject } from '../utils/perObject';

/**
 * Where each target pixel reads, in GL texel space (row 0 at the bottom): the source column is the
 * pixel's column plus `offsetX`, the source row is the pixel's row times `rowStep` plus `offsetY`.
 * A pixel whose texel falls outside `bounds` reads transparent black.
 */
export interface TexelPlacement {
  offsetX: number;
  offsetY: number;
  /** 1 keeps the rows in order, -1 reverses them. */
  rowStep: 1 | -1;
  /** The texels the copy may read, `[left, bottom, right, top)` in GL texel space. */
  bounds: readonly [number, number, number, number];
}

/** Every texel of a `width` x `height` source, in place. */
export function wholeTexels(width: number, height: number): TexelPlacement {
  return { offsetX: 0, offsetY: 0, rowStep: 1, bounds: [0, 0, width, height] };
}

/**
 * What a copy does to each texel's colour, its alpha unchanged. `decode` fills an SRGB8_ALPHA8
 * storage from bytes, which it encodes back to the same byte. `encode` fills an RGBA8 storage from
 * an SRGB8_ALPHA8 one, whose sample decoded the stored byte. `none` copies the texel as it is.
 */
export type TexelTransfer = 'none' | 'decode' | 'encode';

const TRANSFERS: Record<TexelTransfer, string> = {
  none: 'texel',
  decode: 'vec4( sRGBTransferEOTF( texel ).rgb, texel.a )',
  encode: 'vec4( sRGBTransferOETF( texel ).rgb, texel.a )',
};

const copyFragment = (transfer: TexelTransfer) => /* glsl */ `
uniform sampler2D source;
uniform ivec3 placement;
uniform ivec4 bounds;
void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  ivec2 at = ivec2(pixel.x + placement.x, pixel.y * placement.z + placement.y);
  bool inside = all(greaterThanEqual(at, bounds.xy)) && all(lessThan(at, bounds.zw));
  vec4 texel = inside ? texelFetch(source, at, 0) : vec4(0.0);
  gl_FragColor = ${TRANSFERS[transfer]};
}`;

/**
 * The passes of one renderer, one per transfer, not per copy: three leaves a dispose listener that
 * closes over the renderer on each material it draws.
 */
const copyPassesFor = perObject<THREE.WebGLRenderer, Record<TexelTransfer, THREE.ShaderMaterial>>(() => ({
  none: copyPass('none'),
  decode: copyPass('decode'),
  encode: copyPass('encode'),
}));

function copyPass(transfer: TexelTransfer): THREE.ShaderMaterial {
  return fullScreenPass(`TexelCopy:${transfer}`, copyFragment(transfer), {
    source: { value: null },
    placement: { value: [0, 0, 1] },
    bounds: { value: [0, 0, 0, 0] },
  });
}

/**
 * Draws `source`'s texels into `target`, or into the drawing buffer for null, placed by `placement`
 * and converted by `transfer`. The pass holds no texture once the draw ends.
 *
 * @canonical Copy a texture's texels into a render target
 */
export function copyTexels(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture,
  target: THREE.WebGLRenderTarget | null,
  placement: TexelPlacement,
  transfer: TexelTransfer = 'none'
): void {
  const pass = copyPassesFor(gl)[transfer];
  pass.uniforms.source!.value = source;
  pass.uniforms.placement!.value = [placement.offsetX, placement.offsetY, placement.rowStep];
  pass.uniforms.bounds!.value = placement.bounds;
  try {
    drawFullScreen(gl, pass, target);
  } finally {
    pass.uniforms.source!.value = null;
  }
}
