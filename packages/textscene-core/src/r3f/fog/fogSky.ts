/** The sky's prefiltered radiance as the fog passes read it. */

import * as THREE from 'three';
import { glslFloat } from '../../utils/glslLiterals.js';

/** The sky's prefiltered radiance, or null for a scene without one. */
export function skyRadiance(scene: THREE.Scene): THREE.Texture | null {
  const environment = scene.environment;
  return environment?.mapping === THREE.CubeUVReflectionMapping ? environment : null;
}

/** three's defines for sampling the PMREM texture `radiance` (r186 `WebGLProgram.js:398-412`). */
function cubeUvDefines(radiance: THREE.Texture): Record<string, string | number> {
  const imageHeight = (radiance.image as { height: number }).height;
  const maxMip = Math.log2(imageHeight) - 2;
  return {
    ENVMAP_TYPE_CUBE_UV: '',
    CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(2 ** maxMip, 7 * 16)),
    CUBEUV_TEXEL_HEIGHT: 1 / imageHeight,
    CUBEUV_MAX_MIP: glslFloat(maxMip),
  };
}

/**
 * Points `material`'s `envMap` at `radiance` and its defines at the radiance's layout. A layout
 * change recompiles the program, and the same layout keeps it.
 */
export function bindRadiance(material: THREE.ShaderMaterial, radiance: THREE.Texture | null): void {
  const defines = radiance ? cubeUvDefines(radiance) : {};
  if (!sameDefines(material.defines, defines)) {
    material.defines = defines;
    material.needsUpdate = true;
  }
  material.uniforms['envMap']!.value = radiance;
}

function sameDefines(a: Record<string, unknown> | undefined, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a ?? {});
  return aKeys.length === Object.keys(b).length && aKeys.every((name) => a![name] === b[name]);
}
