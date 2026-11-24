import * as THREE from 'three';

/** three's flat background shader (r187 `ShaderLib.js:218-229`). */
export function backgroundPlane(): THREE.ShaderLibShader {
  return THREE.ShaderLib.background!;
}
