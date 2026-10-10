/**
 * Godot's light function in three's physical lighting chunks: Godot's diffuse in the material's
 * `diffuse_mode` and Godot's GGX specular, both on Godot's limited roughness. Godot adds a diffuse
 * with no Fresnel weight (Godot 4.6.3 `scene_forward_lights_inc.glsl:215` and
 * `scene_forward_clustered.glsl:2165`), where three r186 weights it by what the specular reflects.
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';
import type { ProgramInjection } from './materialProgramInputs.js';
import type { Material } from 'three';
import { DIFFUSE_MODE_NAMES, DiffuseMode } from '../godot/diffuseMode.js';
import { recordedOn } from './materials/recordedOnMaterial.js';
import { ROUGHNESS_LIMITER_AMOUNT, ROUGHNESS_LIMITER_LIMIT } from '../godot/roughnessLimiter.js';
import { glslFloat } from '../resources/environment/glslLiterals.js';

const CHUNK = 'lights_physical_pars_fragment';
const SETUP_CHUNK = 'lights_physical_fragment';
const MAPS_CHUNK = 'lights_fragment_maps';

const ROUGHNESS_SETUP = 'material.roughness = min( material.roughness, 1.0 );';

/**
 * The roughness Godot's light functions read: the limiter at its project defaults, with no floor.
 * three's own `material.roughness` floors at 0.0525 for its cubemap mips, which environment
 * reflections keep. Godot snaps a roughness below 1e-8 to 0, where GGX would divide by a collapsed
 * alpha (`scene_forward_clustered.glsl:1667-1671`).
 */
const GODOT_ROUGHNESS = /* glsl */ `${ROUGHNESS_SETUP}
vec3 godotDndu = dFdx( normal );
vec3 godotDndv = dFdy( normal );
float godotVariance = ${glslFloat(ROUGHNESS_LIMITER_AMOUNT)} * ( dot( godotDndu, godotDndu ) + dot( godotDndv, godotDndv ) );
float godotKernelRoughness2 = min( 2.0 * godotVariance, ${glslFloat(ROUGHNESS_LIMITER_LIMIT)} );
material.godotRoughness = sqrt( min( 1.0, roughnessFactor * roughnessFactor + godotKernelRoughness2 ) );
if ( material.godotRoughness < 1e-8 ) material.godotRoughness = 0.0;`;

const MATERIAL_STRUCT = 'struct PhysicalMaterial {';

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

/**
 * Godot's GGX specular (\`scene_forward_lights_inc.glsl:16-47,239-262\`), divided by N.L as three's
 * \`irradiance\` carries it. three's anisotropic D and V have Godot's form, so they take Godot's
 * stretched alphas. Godot's Fresnel is exact Schlick with f90 from F0 (\`:256-261\`).
 */
const SPECULAR_BRDF = /* glsl */ `
// Godot's float order (:16-21), not three's algebraically equal D_GGX, which rounds differently.
float godotGGXDistribution( const in float cNdotH, const in float alpha ) {
	float a = cNdotH * alpha;
	float k = alpha / ( 1.0 - cNdotH * cNdotH + a * a );
	return k * k * RECIPROCAL_PI;
}

float godotGGXVisibility( const in float cNdotL, const in float cNdotV, const in float alpha ) {
	return 0.5 / mix( 2.0 * cNdotL * cNdotV, cNdotL + cNdotV, alpha );
}

vec3 godotSpecularBRDF( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	float cNdotL = saturate( dot( normal, lightDir ) );
	if ( cNdotL <= 0.0 ) return vec3( 0.0 );
	vec3 halfDir = normalize( lightDir + viewDir );
	float cNdotV = max( dot( normal, viewDir ), 1e-4 );
	float cNdotH = saturate( dot( normal, halfDir ) );
	float cLdotH = saturate( dot( lightDir, halfDir ) );
	vec3 f0 = material.specularColorBlended;
	float f90 = clamp( dot( f0, vec3( 50.0 * 0.33 ) ), material.metalness, 1.0 );
	vec3 F = f0 + ( f90 - f0 ) * godotSchlickFresnel( cLdotH );
	#ifdef USE_ANISOTROPY
		vec3 T = material.anisotropyT;
		vec3 B = material.anisotropyB;
		float D = D_GGX_Anisotropic( material.alphaT, material.godotAlphaB, cNdotH, dot( T, halfDir ), dot( B, halfDir ) );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, material.godotAlphaB, dot( T, viewDir ), dot( B, viewDir ), dot( T, lightDir ), dot( B, lightDir ), cNdotV, cNdotL );
	#else
		float alpha = pow2( material.godotRoughness );
		float D = godotGGXDistribution( cNdotH, alpha );
		float V = godotGGXVisibility( cNdotL, cNdotV, alpha );
	#endif
	return F * D * V;
}

`;

const RE_DIRECT = 'void RE_Direct_Physical( const in IncidentLight directLight';

/**
 * three's `dotVH` is Godot's L.H, as H bisects L and V. three's sheen energy compensation stays on
 * the diffuse, as it does on `irradiance`, so Lambert keeps three's exact term.
 */
const DIRECT_DIFFUSE = /* glsl */ `vec3 godotDiffuseIrradiance = godotDiffuseNL( dot( geometryNormal, directLight.direction ), dot( geometryNormal, geometryViewDir ), dotVH, material.godotRoughness ) * directLight.color;
	#ifdef USE_SHEEN
		godotDiffuseIrradiance *= sheenEnergyComp;
	#endif
	reflectedLight.directDiffuse += godotDiffuseIrradiance * BRDF_Lambert( material.diffuseContribution );`;

const THREE_DIRECT_SPECULAR =
  'vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';

const DIRECT_SPECULAR =
  'vec3 specularBRDF = godotSpecularBRDF( directLight.direction, geometryViewDir, geometryNormal, material );';

const THREE_SPECULAR_SUM =
  'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;';

/**
 * Godot draws no specular at roughness 0 (\`scene_forward_lights_inc.glsl:222\`). The rule sits on the
 * sum, after every branch that sets \`specularBRDF\`, as GGX is NaN at alpha 0.
 */
const SPECULAR_SUM = /* glsl */ `if ( material.godotRoughness <= 0.0 ) specularBRDF = vec3( 0.0 );
	${THREE_SPECULAR_SUM}`;

const THREE_ALPHA_T =
  'material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );';

/**
 * Godot stretches the lobe by an aspect ratio of the signed \`anisotropy\` (\`scene_forward_lights_inc.glsl:242-245\`).
 * Godot turns the frame by the flowmap only above 0.01 (\`scene_forward_clustered.glsl:1456-1461\`).
 */
const GODOT_ALPHAS = /* glsl */ `float godotAnisotropy = GODOT_ANISOTROPY_IS_NEGATIVE ? - material.anisotropy : material.anisotropy;
	if ( godotAnisotropy <= 0.01 ) anisotropyV = vec2( 1.0, 0.0 );
	float godotAspect = sqrt( 1.0 - godotAnisotropy * 0.9 );
	material.alphaT = pow2( material.godotRoughness ) / godotAspect;
	material.godotAlphaB = pow2( material.godotRoughness ) * godotAspect;`;

/**
 * The sign \`threeAnisotropy\` turns into the frame. Godot bends an anisotropic reflection about the
 * bitangent, or the tangent when \`anisotropy\` is negative (\`scene_forward_clustered.glsl:1698\`).
 */
const ANISOTROPY_SIGN = /* glsl */ `#define GODOT_ANISOTROPY_IS_NEGATIVE ( anisotropyVector.x < 0.0 )
#define GODOT_IBL_ANISOTROPIC_DIRECTION ( GODOT_ANISOTROPY_IS_NEGATIVE ? material.anisotropyT : material.anisotropyB )
`;

const THREE_IBL_RADIANCE =
  'vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );';
const THREE_IBL_RETRO_RADIANCE =
  'vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );';

/** The reflection line bent about Godot's direction. */
const onGodotIBLDirection = (line: string) =>
  line.replace('material.anisotropyB', 'GODOT_IBL_ANISOTROPIC_DIRECTION');

type LightChunk = typeof CHUNK | typeof SETUP_CHUNK | typeof MAPS_CHUNK;

/**
 * Each edit to three's chunks: Godot's roughness and anisotropic alphas beside three's, Godot's
 * light terms, Godot's direct specular with none at roughness 0, each diffuse line without its
 * Fresnel weight, and the anisotropic reflection bent about Godot's direction.
 */
export const GODOT_LIGHT_FUNCTION_EDITS: readonly ChunkEdit<LightChunk>[] = [
  {
    chunk: CHUNK,
    three: MATERIAL_STRUCT,
    godot: `${MATERIAL_STRUCT}\n\tfloat godotRoughness;\n\tfloat godotAlphaB;`,
  },
  { chunk: SETUP_CHUNK, three: ROUGHNESS_SETUP, godot: GODOT_ROUGHNESS },
  { chunk: CHUNK, three: RE_DIRECT, godot: `${ANISOTROPY_SIGN}${DIFFUSE_NL}${SPECULAR_BRDF}${RE_DIRECT}` },
  { chunk: CHUNK, three: THREE_DIRECT_SPECULAR, godot: DIRECT_SPECULAR },
  { chunk: CHUNK, three: THREE_SPECULAR_SUM, godot: SPECULAR_SUM },
  { chunk: SETUP_CHUNK, three: THREE_ALPHA_T, godot: GODOT_ALPHAS },
  { chunk: MAPS_CHUNK, three: THREE_IBL_RADIANCE, godot: onGodotIBLDirection(THREE_IBL_RADIANCE) },
  {
    chunk: MAPS_CHUNK,
    three: THREE_IBL_RETRO_RADIANCE,
    godot: onGodotIBLDirection(THREE_IBL_RETRO_RADIANCE),
  },
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
 * Replaces three's chunks for every program compiled after the call. A three release that
 * rewrites the lines keeps its own chunk, and `godotLightFunction.test.ts` fails on that release. A
 * second call changes nothing.
 */
export function installGodotLightFunction(): void {
  installChunkPatch({
    names: [CHUNK, SETUP_CHUNK, MAPS_CHUNK],
    isApplied: (chunks) =>
      GODOT_LIGHT_FUNCTION_EDITS.every(({ chunk, godot }) => chunks[chunk].includes(godot)),
    apply: (chunks) => applyChunkEdits(chunks, GODOT_LIGHT_FUNCTION_EDITS),
    missing: `${CHUNK}, ${SETUP_CHUNK} or ${MAPS_CHUNK} lacks a line the light function patch replaces`,
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

/**
 * three's anisotropy props for Godot's signed \`anisotropy\`. three takes a magnitude, so a negative
 * one turns the frame by π, which three's D, V and reflection never see: they read T and B squared
 * or crossed twice. The patched chunks read the sign off \`anisotropyVector\`, so both signs share one
 * program.
 */
export function threeAnisotropy(anisotropy: number): { anisotropy: number; anisotropyRotation: number } {
  return { anisotropy: Math.abs(anisotropy), anisotropyRotation: anisotropy < 0 ? Math.PI : 0 };
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
