/**
 * What `scene.environment` holds while a sky lights the scene. three compiles the environment
 * lighting that the sky lighting patch replaces only for a scene environment in the CubeUV layout
 * (three r186 `WebGLPrograms.js:60-64`, `lights_fragment_maps.glsl.js`). No program samples it:
 * every reader of the sky samples the shown sky's radiance layers (`skyRadiance.ts`).
 */

import * as THREE from 'three';

/**
 * The height of the smallest CubeUV layout three makes, from a cube of 16 (r186 `PMREMGenerator.js:289`).
 * A shorter one gives three's CubeUV defines a negative last mip, which fails to compile.
 */
const CUBE_UV_HEIGHT = 4 * 16;

/**
 * A new switch for each bake, so a reader that compares `scene.environment`, as the reflection
 * probes do (`sceneProbes.ts`), sees the sky change. The caller disposes it with the bake.
 */
export function createEnvironmentSwitch(): THREE.DataTexture {
  const environment = new THREE.DataTexture(new Uint8Array(4 * CUBE_UV_HEIGHT), 1, CUBE_UV_HEIGHT);
  environment.mapping = THREE.CubeUVReflectionMapping;
  environment.needsUpdate = true;
  return environment;
}
