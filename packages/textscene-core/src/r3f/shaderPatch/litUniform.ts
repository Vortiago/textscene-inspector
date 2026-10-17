/**
 * How this repository gives three's built-in materials a uniform that a patched chunk declares, and
 * finds the value an earlier evaluation of a module installed.
 */

import * as THREE from 'three';

/**
 * One of `UniformsLib`'s groups, and the uniform that marks a `ShaderLib` entry as merging it,
 * which no entry outside the group holds.
 */
interface UniformsMerge {
  marker: string;
  group: Record<string, THREE.IUniform>;
}

/**
 * The lit materials and `ShadowMaterial` merge `UniformsLib.lights` (r186 `ShaderLib.js:40`, `:65`,
 * `:93`, `:119`, `:289`, and `physical` through `standard`).
 */
const LIGHTS_MERGE: UniformsMerge = {
  marker: 'pointLightShadows',
  group: THREE.UniformsLib.lights as Record<string, THREE.IUniform>,
};

/** Every material with fog merges `UniformsLib.fog`, and only they hold `fogDensity`. */
export const FOG_UNIFORMS_MERGE: UniformsMerge = {
  marker: 'fogDensity',
  group: THREE.UniformsLib.fog as Record<string, THREE.IUniform>,
};

/**
 * Gives `value` to every built-in material that makes `merge`, and to its group, for every material
 * created after the call.
 */
export function installMergedUniform(merge: UniformsMerge, name: string, value: unknown): void {
  for (const shader of Object.values(THREE.ShaderLib)) {
    if (merge.marker in shader.uniforms) shader.uniforms[name] = { value };
  }
  merge.group[name] = { value };
}

/** {@link installMergedUniform} for the lit materials. */
export function installLitUniform(name: string, value: unknown): void {
  installMergedUniform(LIGHTS_MERGE, name, value);
}

/**
 * The value an earlier evaluation of a module gave `program`, as after a dev server reloads it, or
 * undefined before any install. Every program compiled since reads that value, so the caller keeps
 * writing it. The default, `standard`, makes both merges. The caller narrows the type.
 */
export function installedUniformValue(
  name: string,
  program: keyof typeof THREE.ShaderLib = 'standard'
): unknown {
  return THREE.ShaderLib[program]?.uniforms[name]?.value;
}

/** The value installed under `name` when it is a `type`, as after a reload, or else `make`'s. */
export function installedOr<T>(
  name: string,
  type: abstract new (...args: never[]) => T,
  make: () => T,
  program: keyof typeof THREE.ShaderLib = 'standard'
): T {
  const value = installedUniformValue(name, program);
  return value instanceof type ? value : make();
}
