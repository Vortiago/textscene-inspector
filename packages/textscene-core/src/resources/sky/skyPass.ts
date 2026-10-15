/** The sky bake's passes, each a full-screen pass whose uniforms the bake sets by name. */

import * as THREE from 'three';
import { fullScreenPass } from '../../r3f/fullScreenPass.js';

/** A pass for `fragmentShader`, its uniforms `uniformNames`, each empty until the bake sets it. */
export function skyPass(fragmentShader: string, uniformNames: readonly string[]): THREE.ShaderMaterial {
  return fullScreenPass(
    'SkyPass',
    fragmentShader,
    Object.fromEntries(uniformNames.map((name) => [name, { value: null }]))
  );
}

export function setUniforms(pass: THREE.ShaderMaterial, values: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(values)) {
    const uniform = pass.uniforms[name];
    if (!uniform) throw new Error(`expected a uniform of the pass, got ${name}`);
    uniform.value = value;
  }
}

/** Lets go of the textures `pass` reads, as a pass outlives the bake that set them. */
export function releaseTextures(pass: THREE.ShaderMaterial): void {
  for (const uniform of Object.values(pass.uniforms)) {
    if (uniform.value instanceof THREE.Texture) uniform.value = null;
  }
}
