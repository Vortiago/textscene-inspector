/**
 * The height of the framebuffer a render draws into, which the positional shadow lookups read to
 * count a fragment's rows from the top, as Vulkan's `gl_FragCoord` does in Godot. WebGL counts them
 * from the bottom. Godot turns its PCF kernel per fragment by a hash of that position
 * (`scene_forward_lights_inc.glsl:343-350`), so the same rows give the same dither.
 */

import * as THREE from 'three';

/** The uniform the lookups read the height from. */
export const FRAMEBUFFER_HEIGHT_UNIFORM = 'godotFramebufferHeight';

/**
 * The height an earlier evaluation of this module gave `ShaderLib`, as after a dev server reloads it,
 * so this evaluation writes the buffer every compiled program reads.
 */
function installedHeight(): Float32Array | null {
  const installed: unknown = THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]?.value;
  return installed instanceof Float32Array ? installed : null;
}

/**
 * One shared value. `UniformsUtils.cloneUniforms` keeps a typed array by reference
 * (three r186 `UniformsUtils.js:43-64`), so every material's clone reads this buffer. Written only by
 * `writeFramebufferHeight`, before each render's draw.
 */
export const framebufferHeight = installedHeight() ?? new Float32Array(1);

/** Records the height of the framebuffer `renderer` draws into now. */
export function writeFramebufferHeight(renderer: THREE.WebGLRenderer): void {
  const target = renderer.getRenderTarget();
  framebufferHeight[0] = target ? target.height : renderer.getDrawingBufferSize(new THREE.Vector2()).y;
}
