/**
 * The height of the framebuffer a render draws into, which the soft shadow filter reads to count a
 * fragment's rows from the top, as Vulkan's `gl_FragCoord` does in Godot. WebGL counts them from the
 * bottom. Godot turns its PCF kernel per fragment by a hash of that position
 * (`scene_forward_lights_inc.glsl:292-298`, `:343-350`), so the same rows give the same dither.
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
 * `writeFramebufferHeight`, which the renderer's shadow pass calls before each render's draw
 * (`../positionalShadow/positionalShadowPass.ts`).
 */
export const framebufferHeight = installedHeight() ?? new Float32Array(1);

/**
 * Gives every built-in lit material and `UniformsLib.lights` the height, for every program compiled
 * after the call.
 */
export function installFramebufferHeightUniform(): void {
  const lit = Object.values(THREE.ShaderLib)
    .map((shader) => shader.uniforms)
    .filter((uniforms) => 'pointLightShadows' in uniforms);
  for (const uniforms of [...lit, THREE.UniformsLib.lights as Record<string, THREE.IUniform>]) {
    uniforms[FRAMEBUFFER_HEIGHT_UNIFORM] = { value: framebufferHeight };
  }
}

/** Records the height of the framebuffer `renderer` draws into now. */
export function writeFramebufferHeight(renderer: THREE.WebGLRenderer): void {
  const target = renderer.getRenderTarget();
  framebufferHeight[0] = target ? target.height : renderer.getDrawingBufferSize(new THREE.Vector2()).y;
}
