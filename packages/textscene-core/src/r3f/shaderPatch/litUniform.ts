/**
 * How this repository gives three's lit materials a uniform that a patched chunk declares, and finds
 * the value an earlier evaluation of a module installed.
 */

import * as THREE from 'three';

/**
 * Gives `value` to every built-in material that merges `UniformsLib.lights`, and to
 * `UniformsLib.lights`, for every material created after the call. `pointLightShadows` marks the
 * merge, which three's lit materials and `ShadowMaterial` make and no other entry does (r186
 * `ShaderLib.js:40`, `:65`, `:93`, `:119`, `:289`, and `physical` through `standard`).
 */
export function installLitUniform(name: string, value: unknown): void {
  for (const shader of Object.values(THREE.ShaderLib)) {
    if ('pointLightShadows' in shader.uniforms) shader.uniforms[name] = { value };
  }
  (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[name] = { value };
}

/**
 * The value an earlier evaluation of a module gave the lit materials, as after a dev server reloads
 * it, or undefined before any install. Every program compiled since reads that value, so the caller
 * keeps writing it. The caller narrows the type.
 */
export function installedUniformValue(name: string): unknown {
  return THREE.ShaderLib.standard.uniforms[name]?.value;
}
