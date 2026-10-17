/** three's two background programs, which its types leave optional though every release ships them. */

import * as THREE from 'three';

/** three's cube background shader (r186 `ShaderLib.js:231-243`). */
export function backgroundCube(): THREE.ShaderLibShader {
  return THREE.ShaderLib.backgroundCube!;
}

/** three's flat background shader (r186 `ShaderLib.js:218-229`). */
export function backgroundPlane(): THREE.ShaderLibShader {
  return THREE.ShaderLib.background!;
}
