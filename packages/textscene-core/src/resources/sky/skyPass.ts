/** The sky bake's passes, each a full-screen pass whose uniforms the bake sets by name. */

import type * as THREE from 'three';
import { namedUniformPass } from '../../r3f/fullScreenPass.js';

/** A pass for `fragmentShader`, its uniforms `uniformNames`, each empty until the bake sets it. */
export function skyPass(fragmentShader: string, uniformNames: readonly string[]): THREE.ShaderMaterial {
  return namedUniformPass('SkyPass', fragmentShader, uniformNames);
}
