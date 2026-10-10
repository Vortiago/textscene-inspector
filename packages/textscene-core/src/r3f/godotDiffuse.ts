/**
 * Godot's diffuse term in three's physical lighting chunk. Godot adds a light's diffuse and the
 * ambient diffuse with no Fresnel weight (Godot 4.6.3 `scene_forward_lights_inc.glsl:215` and
 * `scene_forward_clustered.glsl:2165`). three r186 weights both by what the specular layer
 * reflects (glTF `fresnel_mix`), which darkens every dielectric by about 4 %. A light's diffuse
 * also follows the material's `diffuse_mode`: Burley, BaseMaterial3D's default, unless a define in
 * its program picks another.
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';
import type { ProgramInjection } from './materialProgramInputs.js';
import type { Material } from 'three';
import { DIFFUSE_MODE_NAMES, DiffuseMode } from '../godot/diffuseMode.js';
import { recordedOn } from './materials/recordedOnMaterial.js';

const CHUNK = 'lights_physical_pars_fragment';

/**
 * `diffuse_brdf_NL` times pi in each mode (`scene_forward_lights_inc.glsl:133-134,194-213`), as
 * `BRDF_Lambert` carries the 1 / pi. It takes the raw N.L, since wrap and toon read past the
 * terminator. Godot's light size `A` is 0 for a punctual light. Burley is the branch with no define.
 */
const DIFFUSE_NL = /* glsl */ `
float godotSchlickFresnel( const in float u ) {
	float m = 1.0 - u;
	float m2 = m * m;
	return m2 * m2 * m;
}

float godotDiffuseNL( const in float dotNLRaw, const in float dotNVRaw, const in float dotLH, const in float roughness ) {
	float NdotL = min( dotNLRaw, 1.0 );
	float cNdotL = max( NdotL, 0.0 );
	#if defined( GODOT_DIFFUSE_LAMBERT )
		return cNdotL;
	#elif defined( GODOT_DIFFUSE_LAMBERT_WRAP )
		float opRoughness = 1.0 + roughness;
		return max( 0.0, ( NdotL + roughness ) / ( opRoughness * opRoughness ) );
	#elif defined( GODOT_DIFFUSE_TOON )
		return smoothstep( - roughness, max( roughness, 0.01 ), NdotL );
	#else
		float cNdotV = max( dotNVRaw, 1e-4 );
		float fd90Minus1 = 2.0 * dotLH * dotLH * roughness - 0.5;
		float fdV = 1.0 + fd90Minus1 * godotSchlickFresnel( cNdotV );
		float fdL = 1.0 + fd90Minus1 * godotSchlickFresnel( cNdotL );
		return fdV * fdL * cNdotL;
	#endif
}

`;

const RE_DIRECT = 'void RE_Direct_Physical( const in IncidentLight directLight';

/**
 * three's `dotVH` is Godot's L.H, as H bisects L and V. three's sheen energy compensation stays on
 * the diffuse, as it does on `irradiance`, so Lambert keeps three's exact term.
 */
const DIRECT_DIFFUSE = /* glsl */ `vec3 godotDiffuseIrradiance = godotDiffuseNL( dot( geometryNormal, directLight.direction ), dot( geometryNormal, geometryViewDir ), dotVH, material.roughness ) * directLight.color;
	#ifdef USE_SHEEN
		godotDiffuseIrradiance *= sheenEnergyComp;
	#endif
	reflectedLight.directDiffuse += godotDiffuseIrradiance * BRDF_Lambert( material.diffuseContribution );`;

/** Each edit to three's chunk: the mode-aware light term, and each diffuse line without its Fresnel weight. */
export const GODOT_DIFFUSE_EDITS: readonly ChunkEdit<typeof CHUNK>[] = [
  { chunk: CHUNK, three: RE_DIRECT, godot: `${DIFFUSE_NL}${RE_DIRECT}` },
  {
    chunk: CHUNK,
    three:
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );',
    godot: DIRECT_DIFFUSE,
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
    isApplied: (chunks) => GODOT_DIFFUSE_EDITS.every(({ godot }) => chunks[CHUNK].includes(godot)),
    apply: (chunks) => applyChunkEdits(chunks, GODOT_DIFFUSE_EDITS),
    missing: `${CHUNK} has no direct light function or Fresnel-weighted diffuse line to replace`,
  });
}

function defining(define: string): ProgramInjection {
  return {
    cacheKey: define.toLowerCase(),
    onBeforeCompile(shader) {
      shader.fragmentShader = `#define ${define}\n${shader.fragmentShader}`;
    },
  };
}

/**
 * Each mode's define, one injection per mode so a program's injection keeps its identity across
 * materials. Burley takes none, so a lit standard or physical material with no injection draws
 * Burley: a material that stands for a Godot surface in another mode must bring its define.
 */
const MODE_INJECTIONS: ReadonlyMap<number, ProgramInjection> = new Map(
  [DiffuseMode.DIFFUSE_LAMBERT, DiffuseMode.DIFFUSE_LAMBERT_WRAP, DiffuseMode.DIFFUSE_TOON].map((mode) => [
    mode,
    defining(`GODOT_${DIFFUSE_MODE_NAMES[mode]}`),
  ])
);

/**
 * What a lit material with this `diffuse_mode` compiles with: nothing for Burley. A mode past the
 * enum gets no render mode (`material.cpp:828-841`), and a spatial shader without one draws Lambert
 * (`shader_types.cpp:241`).
 */
export function diffuseModeInjection(mode: number): ProgramInjection | undefined {
  if (mode === DiffuseMode.DIFFUSE_BURLEY) return undefined;
  return MODE_INJECTIONS.get(mode) ?? MODE_INJECTIONS.get(DiffuseMode.DIFFUSE_LAMBERT);
}

/** Where a material records the `diffuse_mode` of the surface it draws. */
const DIFFUSE_MODE_KEY = 'godotDiffuseMode';

/** The `userData` that records a surface's `diffuse_mode`, for a draw that shades it again. */
export function diffuseModeUserData(mode: number): Record<string, unknown> {
  return { [DIFFUSE_MODE_KEY]: mode };
}

/** The `diffuse_mode` `material` records, or Burley for a material this derivation did not build. */
export function diffuseModeOf(material: Material): number {
  return recordedOn(material, DIFFUSE_MODE_KEY, DiffuseMode.DIFFUSE_BURLEY);
}
