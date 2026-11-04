/**
 * A render target that holds a fixed number of mips, which passes draw one by one, so a read
 * between them finds the texture complete.
 */

import type * as THREE from 'three';

/**
 * `target` with `levels` mips, each half the one before. A render target reads only the count
 * (three r187 `WebGLTextures.js:2122-2130`), which the type of `Texture.mipmaps` does not name, and
 * caps `TEXTURE_MAX_LEVEL` at the last level (`:2293-2297`), so no level past the drawn ones is read.
 *
 * @canonical A render target with a mip chain that passes draw
 */
export function withMipLevels<T extends THREE.WebGLRenderTarget>(target: T, levels: number): T {
  target.texture.mipmaps = Array.from({ length: levels }, () => ({})) as unknown as THREE.Texture['mipmaps'];
  return target;
}
