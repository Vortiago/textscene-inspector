/**
 * A fragment shader as a material's `onBeforeCompile` leaves it, without a GL context, and the
 * patches a test reads off it.
 */

import * as THREE from 'three';
import type { ProgramShader } from '../materialProgramInputs';

/** The fragment shader of each three class a Godot surface draws with, by material type. */
export const FRAGMENT_SHADER_OF_TYPE: Readonly<Record<string, string>> = {
  MeshBasicMaterial: THREE.ShaderLib.basic.fragmentShader,
  MeshStandardMaterial: THREE.ShaderLib.standard.fragmentShader,
  MeshPhysicalMaterial: THREE.ShaderLib.physical.fragmentShader,
};

/** The shader resets the alpha to `opacity`, dropping the texture and vertex-colour alpha. */
export const DROPS_ALBEDO_ALPHA = 'diffuseColor.a = opacity;';

/** The shader writes alpha 1 for each fragment the cut keeps. */
export const WRITES_OPAQUE_AFTER_CUT = 'diffuseColor.a = 1.0;';

/** The shader scales the direct light by the AO map's occlusion. */
export const OCCLUDES_DIRECT_LIGHT = 'reflectedLight.directDiffuse *= godotDirectOcclusion;';

/** `fragmentShader` after `onBeforeCompile`, which reads only the shader, so no renderer is needed. */
export function patchedShader(
  onBeforeCompile: (shader: ProgramShader) => void,
  fragmentShader: string
): string {
  const shader: ProgramShader = { vertexShader: '', fragmentShader, uniforms: {} };
  onBeforeCompile(shader);
  return shader.fragmentShader;
}

export function patchedFragment(material: THREE.Material): string {
  const fragmentShader = FRAGMENT_SHADER_OF_TYPE[material.type];
  if (fragmentShader === undefined) {
    throw new Error(`expected a mesh basic, standard or physical material, got ${material.type}`);
  }
  return patchedShader(
    (shader) =>
      material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, undefined as never),
    fragmentShader
  );
}
