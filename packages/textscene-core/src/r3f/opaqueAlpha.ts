/**
 * The alpha of an opaque Godot viewport. Godot samples a target without `transparent_bg` with
 * `swizzle_a = ONE` (`texture_storage.cpp:3641-3642`), so a SUB or MUL item that lowers the alpha
 * it writes never lets what lies behind the viewport show through.
 */
import type * as THREE from 'three';

/**
 * Sets the alpha of the bound colour buffer to 1 and leaves its colour.
 *
 * @canonical The alpha of an opaque viewport's image
 */
export function fillAlphaWithOne(gl: THREE.WebGLRenderer): void {
  const context = gl.getContext();
  context.colorMask(false, false, false, true);
  context.clearColor(0, 0, 0, 1);
  context.clear(context.COLOR_BUFFER_BIT);
  context.colorMask(true, true, true, true);
  // Raw calls, so three's cached mask and clear colour are stale until reset.
  gl.state.buffers.color.reset();
}
