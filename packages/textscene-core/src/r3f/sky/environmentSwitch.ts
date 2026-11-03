/**
 * What `scene.environment` holds while a sky lights the scene. three compiles the environment
 * lighting that the sky lighting patch replaces only for a prefiltered (PMREM) scene environment
 * (three r187 `WebGLPrograms.js:60-61,129`, `lights_fragment_maps.glsl.js`). No program samples it:
 * every reader of the sky samples the shown sky's radiance layers (`skyRadiance.ts`).
 */

import * as THREE from 'three';

/**
 * three reads a prefiltered environment's size and last mip from its `mipmaps` (r187
 * `WebGLPrograms.js:191,225-226`), as `PMREMGenerator` lists them. The switch never uploads, as
 * three uploads a cube's `mipmaps` as pixel levels: its sampler binds no texture, which no program reads.
 */
function createEnvironmentSwitch(): THREE.CubeTexture {
  const environment = new THREE.CubeTexture();
  environment.isPMREMTexture = true;
  environment.mipmaps = [{ width: 1, height: 1 } as THREE.CompressedTextureMipmap];
  return environment;
}

/**
 * The one switch every sky shows. three compares `scene.environment` by identity, so a pass that puts
 * another sky on resolves no program again. It holds no GL texture, so a canvas has nothing to free.
 */
export const ENVIRONMENT_SWITCH = createEnvironmentSwitch();
