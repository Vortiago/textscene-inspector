/**
 * The height of the framebuffer a render draws into, which the soft shadow filter reads to count a
 * fragment's rows from the top, as Vulkan's `gl_FragCoord` does in Godot. WebGL counts them from the
 * bottom. Godot turns its PCF kernel per fragment by a hash of that position
 * (`scene_forward_lights_inc.glsl:292-298`, `:343-350`), so the same rows give the same dither.
 */

import * as THREE from 'three';
import { installLitUniform, installedUniformValue } from '../shaderPatch/litUniform.js';

/** The uniform the lookups read the height from. */
export const FRAMEBUFFER_HEIGHT_UNIFORM = 'godotFramebufferHeight';

const installedHeight = installedUniformValue(FRAMEBUFFER_HEIGHT_UNIFORM);

/**
 * One shared value. `UniformsUtils.cloneUniforms` keeps a typed array by reference
 * (three r186 `UniformsUtils.js:43-64`), so every material's clone reads this buffer. Written only by
 * `writeFramebufferHeight`, which the renderer's shadow pass calls before each render's draw
 * (`../positionalShadow/positionalShadowPass.ts`). After a dev server reloads this module, it is the
 * buffer the earlier evaluation installed, which every compiled program reads.
 */
export const framebufferHeight =
  installedHeight instanceof Float32Array ? installedHeight : new Float32Array(1);

/** Written only by `writeFramebufferHeight`, which reads it at once. */
const drawingBufferSize = new THREE.Vector2();

/**
 * Gives every built-in lit material and `UniformsLib.lights` the height, for every program compiled
 * after the call.
 */
export function installFramebufferHeightUniform(): void {
  installLitUniform(FRAMEBUFFER_HEIGHT_UNIFORM, framebufferHeight);
}

/** Records the height of the framebuffer `renderer` draws into now. */
export function writeFramebufferHeight(renderer: THREE.WebGLRenderer): void {
  const target = renderer.getRenderTarget();
  framebufferHeight[0] = target ? target.height : renderer.getDrawingBufferSize(drawingBufferSize).y;
}
