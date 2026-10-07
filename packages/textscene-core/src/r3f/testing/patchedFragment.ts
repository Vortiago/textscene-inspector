/**
 * A material's fragment shader as its `onBeforeCompile` leaves it, without a GL context, and the
 * fragment-alpha patches a test reads off it.
 */

import * as THREE from 'three';
import type { ProgramShader } from '../materialProgramInputs';

const FRAGMENT_SHADER_OF_TYPE: Readonly<Record<string, string>> = {
  MeshBasicMaterial: THREE.ShaderLib.basic.fragmentShader,
  MeshStandardMaterial: THREE.ShaderLib.standard.fragmentShader,
  MeshPhysicalMaterial: THREE.ShaderLib.physical.fragmentShader,
};

/** The shader resets the alpha to `opacity`, dropping the texture and vertex-colour alpha. */
export const DROPS_ALBEDO_ALPHA = 'diffuseColor.a = opacity;';

/** The shader writes alpha 1 for each fragment the cut keeps. */
export const OPAQUE_AFTER_CUT = 'diffuseColor.a = 1.0;';

export function patchedFragment(material: THREE.Material): string {
  const fragmentShader = FRAGMENT_SHADER_OF_TYPE[material.type];
  if (fragmentShader === undefined)
    throw new Error(`expected a mesh basic, standard or physical material, got ${material.type}`);
  const shader: ProgramShader = { vertexShader: '', fragmentShader, uniforms: {} };
  // The patches read only the shader, so no renderer is needed.
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, undefined as never);
  return shader.fragmentShader;
}
