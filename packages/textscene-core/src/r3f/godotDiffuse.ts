/**
 * Godot's diffuse term in three's physical lighting chunk. Godot adds a light's diffuse and the
 * ambient diffuse with no Fresnel weight (Godot 4.6.3 `scene_forward_lights_inc.glsl:215` and
 * `scene_forward_clustered.glsl:2165`). three r186 weights both by what the specular layer
 * reflects (glTF `fresnel_mix`), which darkens every dielectric by about 4 %.
 */

import * as THREE from 'three';
import { warn } from '../logger';

const CHUNK = 'lights_physical_pars_fragment';

/** Each Fresnel-weighted diffuse line in three's chunk, and Godot's unweighted form. */
export const FRESNEL_WEIGHTED_DIFFUSE: readonly (readonly [weighted: string, godot: string])[] = [
  [
    'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
    'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );',
  ],
  [
    'vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );',
    'vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );',
  ],
];

/** The chunk with each weighted line in Godot's form, or null when a line is missing from it. */
export function godotDiffuseChunk(chunk: string): string | null {
  let patched = chunk;
  for (const [weighted, godot] of FRESNEL_WEIGHTED_DIFFUSE) {
    if (!patched.includes(weighted)) return null;
    patched = patched.replace(weighted, godot);
  }
  return patched;
}

/**
 * Replaces three's chunk for every program compiled after the call. A three release that
 * rewrites the lines keeps its own chunk, and `godotDiffuse.test.ts` fails on that release.
 */
export function installGodotDiffuse(): void {
  const patched = godotDiffuseChunk(THREE.ShaderChunk[CHUNK]);
  if (patched === null) {
    warn(`[Shading] three's ${CHUNK} has no Fresnel-weighted diffuse line to replace`);
    return;
  }
  THREE.ShaderChunk[CHUNK] = patched;
}
