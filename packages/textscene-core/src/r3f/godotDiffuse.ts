/**
 * Godot's diffuse term in three's physical lighting chunk. Godot adds a light's diffuse and the
 * ambient diffuse with no Fresnel weight (Godot 4.6.3 `scene_forward_lights_inc.glsl:215` and
 * `scene_forward_clustered.glsl:2165`). three r186 weights both by what the specular layer
 * reflects (glTF `fresnel_mix`), which darkens every dielectric by about 4 %.
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';

const CHUNK = 'lights_physical_pars_fragment';

/** Each Fresnel-weighted diffuse line in three's chunk, in Godot's unweighted form. */
export const FRESNEL_WEIGHTED_DIFFUSE: readonly ChunkEdit<typeof CHUNK>[] = [
  {
    chunk: CHUNK,
    three:
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
    godot: 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );',
  },
  {
    chunk: CHUNK,
    three:
      'vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );',
    godot: 'vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );',
  },
];

/**
 * Replaces three's chunk for every program compiled after the call. A three release that
 * rewrites the lines keeps its own chunk, and `godotDiffuse.test.ts` fails on that release. A
 * second call changes nothing.
 */
export function installGodotDiffuse(): void {
  installChunkPatch({
    names: [CHUNK],
    isApplied: (chunks) => FRESNEL_WEIGHTED_DIFFUSE.every(({ godot }) => chunks[CHUNK].includes(godot)),
    apply: (chunks) => applyChunkEdits(chunks, FRESNEL_WEIGHTED_DIFFUSE),
    missing: `${CHUNK} has no Fresnel-weighted diffuse line to replace`,
  });
}
