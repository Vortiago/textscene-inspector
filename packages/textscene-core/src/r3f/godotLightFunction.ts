/**
 * Godot's light function in three's physical lighting chunks: Godot's diffuse in the material's
 * `diffuse_mode` and Godot's GGX specular, both on Godot's limited roughness. Godot adds a diffuse
 * with no Fresnel weight (Godot 4.6.3 `scene_forward_lights_inc.glsl:215` and
 * `scene_forward_clustered.glsl:2165`), where three r186 weights it by what the specular reflects.
 */

import { editedShader, installChunkEdits, type ChunkEdit, type TextEdit } from './shaderPatch/chunkPatch.js';
import { installGodotNormalMapRead } from './materials/godotNormalMap.js';
import { installGodotLightSize } from './lightSize/lightSizeChunk.js';
import { installGodotLightSpecular } from './lightSpecular/lightSpecularChunk.js';
import { ROUGHNESS_LIMITER_AMOUNT, ROUGHNESS_LIMITER_LIMIT } from '../godot/rendering/roughnessLimiter.js';
import { glslFloat } from '../utils/glslLiterals.js';

const CHUNK = 'lights_physical_pars_fragment';
const SETUP_CHUNK = 'lights_physical_fragment';
const MAPS_CHUNK = 'lights_fragment_maps';

const ROUGHNESS_SETUP = 'material.roughness = min( material.roughness, 1.0 );';

/**
 * Godot's limiter reads the fine `dFdx( normal )` (`scene_forward_clustered.glsl:1660`), but WebGL 2
 * has none: a coarse one spans a 2 x 2 quad. A mapped normal takes its pixel pair's difference from
 * the map read one texel along the pair. Roughness 1 stays 1, so that pixel skips the reads.
 */
const NORMAL_DERIVATIVES = /* glsl */ `#ifdef USE_NORMALMAP_TANGENTSPACE
mat3 godotTbnDx = mat3( dFdx( tbn[ 0 ] ), dFdx( tbn[ 1 ] ), dFdx( tbn[ 2 ] ) );
mat3 godotTbnDy = mat3( dFdy( tbn[ 0 ] ), dFdy( tbn[ 1 ] ), dFdy( tbn[ 2 ] ) );
vec2 godotPair = 1.0 - 2.0 * mod( floor( gl_FragCoord.xy ), 2.0 );
vec3 godotDndu = vec3( 0.0 );
vec3 godotDndv = vec3( 0.0 );
if ( roughnessFactor < 1.0 ) {
	godotDndu = godotPair.x * ( godotMapNormal( vNormalMapUv + godotPair.x * godotUvDx, godotUvDx, godotUvDy, tbn + godotPair.x * godotTbnDx ) - normal );
	godotDndv = godotPair.y * ( godotMapNormal( vNormalMapUv + godotPair.y * godotUvDy, godotUvDx, godotUvDy, tbn + godotPair.y * godotTbnDy ) - normal );
}
#else
vec3 godotDndu = dFdx( normal );
vec3 godotDndv = dFdy( normal );
#endif`;

/**
 * The roughness Godot's light functions and sky reflection read: the limiter at its project
 * defaults, with no floor. three's own `material.roughness` floors at 0.0525 and stays for the
 * terms the patches leave to three. Godot snaps a roughness below 1e-8 to 0, where GGX would
 * divide by a collapsed alpha (`scene_forward_clustered.glsl:1667-1671`).
 */
const GODOT_ROUGHNESS = /* glsl */ `${ROUGHNESS_SETUP}
${NORMAL_DERIVATIVES}
float godotVariance = ${glslFloat(ROUGHNESS_LIMITER_AMOUNT)} * ( dot( godotDndu, godotDndu ) + dot( godotDndv, godotDndv ) );
float godotKernelRoughness2 = min( 2.0 * godotVariance, ${glslFloat(ROUGHNESS_LIMITER_LIMIT)} );
material.godotRoughness = sqrt( min( 1.0, roughnessFactor * roughnessFactor + godotKernelRoughness2 ) );
if ( material.godotRoughness < 1e-8 ) material.godotRoughness = 0.0;`;

const MATERIAL_STRUCT = 'struct PhysicalMaterial {';

/**
 * `diffuse_brdf_NL` times pi in each mode (`scene_forward_lights_inc.glsl:133-134,194-213`), as
 * `BRDF_Lambert` carries the 1 / pi. It takes the raw N.L, since wrap and toon read past the
 * terminator. The caller adds the light's size offset `A` to N.L and L.H. Burley is the branch with
 * no define.
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
 * Godot's GGX specular (`scene_forward_lights_inc.glsl:16-47,239-262`), divided by N.L as three's
 * `irradiance` carries it. `sizeOffset` is the light's `A`, which widens N.L, N.H and L.H (`:171`,
 * `:224`). three's anisotropic D and V have Godot's form, so they take Godot's
 * stretched alphas. Godot's Fresnel is exact Schlick with f90 from F0 (`:256-261`).
 */
const SPECULAR_BRDF = /* glsl */ `
// Godot's D_GGX (:16-26) operation for operation, not three's algebraically equal D_GGX.
float godotGGXDistribution( const in float cNdotH, const in float alpha ) {
	float a = cNdotH * alpha;
	float k = alpha / ( 1.0 - cNdotH * cNdotH + a * a );
	return k * k * RECIPROCAL_PI;
}

float godotGGXVisibility( const in float cNdotL, const in float cNdotV, const in float alpha ) {
	return 0.5 / mix( 2.0 * cNdotL * cNdotV, cNdotL + cNdotV, alpha );
}

vec3 godotSpecularBRDF( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material, const in float sizeOffset ) {
	float cNdotL = saturate( sizeOffset + dot( normal, lightDir ) );
	if ( cNdotL <= 0.0 ) return vec3( 0.0 );
	vec3 halfDir = normalize( lightDir + viewDir );
	float cNdotV = max( dot( normal, viewDir ), 1e-4 );
	float cNdotH = saturate( sizeOffset + dot( normal, halfDir ) );
	float cLdotH = saturate( sizeOffset + dot( lightDir, halfDir ) );
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

float godotToonIntensity( const in float RdotV, const in float roughness ) {
	float mid = 1.0 - roughness;
	mid *= mid;
	return smoothstep( mid - roughness * 0.5, mid + roughness * 0.5, RdotV ) * mid;
}

float godotToonSpecular( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
	vec3 R = normalize( - reflect( lightDir, normal ) );
	return godotToonIntensity( dot( R, viewDir ), roughness );
}

`;

/** The signature of three's direct light function, before which a patch declares its helpers. */
export const RE_DIRECT = 'void RE_Direct_Physical( const in IncidentLight directLight';

/**
 * three's `dotVH` is Godot's L.H, as H bisects L and V. three's sheen energy compensation stays on
 * the diffuse, as it does on `irradiance`, so Lambert keeps three's exact term.
 */
const DIRECT_DIFFUSE = /* glsl */ `vec3 godotDiffuseIrradiance = godotDiffuseNL( godotSizeOffset + dot( geometryNormal, directLight.direction ), dot( geometryNormal, geometryViewDir ), saturate( godotSizeOffset + dotVH ), material.godotRoughness ) * directLight.color;
	#ifdef USE_SHEEN
		godotDiffuseIrradiance *= sheenEnergyComp;
	#endif
	reflectedLight.directDiffuse += godotDiffuseIrradiance * BRDF_Lambert( material.diffuseContribution );`;

const THREE_DIRECT_SPECULAR =
  'vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';

const DIRECT_SPECULAR =
  'vec3 specularBRDF = godotSpecularBRDF( directLight.direction, geometryViewDir, geometryNormal, material, godotSizeOffset );';

const THREE_IRRADIANCE_NL = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';

/** Godot's specular and clearcoat read the N.L the light's size widens (`:133`, `:168`). */
const IRRADIANCE_NL =
  'float dotNL = saturate( godotSizeOffset + dot( geometryNormal, directLight.direction ) );';

const THREE_SPECULAR_SUM =
  'reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;';

/**
 * Godot draws a light's specular only above roughness 0 (`scene_forward_lights_inc.glsl:222-264`),
 * in the material's `specular_mode`: GGX unless a define picks another. Toon writes to the diffuse,
 * which Godot then scales by albedo and `1 - metallic` (`scene_forward_clustered.glsl:2941-2948`).
 * The rule sits on the sum, after every branch that sets `specularBRDF`, as GGX is NaN at alpha 0.
 * Each mode scales by the light's specular amount (`lightSpecular/lightSpecularChunk.ts`).
 */
const SPECULAR_SUM = /* glsl */ `if ( material.godotRoughness <= 0.0 ) {
		specularBRDF = vec3( 0.0 );
	} else {
		#if defined( GODOT_SPECULAR_TOON )
			specularBRDF = vec3( 0.0 );
			reflectedLight.directDiffuse += godotToonSpecular( directLight.direction, geometryViewDir, geometryNormal, material.godotRoughness ) * directLight.color * godotSpecularAmount * material.diffuseContribution;
		#elif defined( GODOT_SPECULAR_DISABLED )
			specularBRDF = vec3( 0.0 );
		#endif
	}
	specularBRDF *= godotSpecularAmount;
	${THREE_SPECULAR_SUM}`;

const THREE_RETRO_SPECULAR =
  'vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );';

/** Godot has no retroreflection, so a retroreflective lobe takes Godot's GGX and its stretched alphas. */
const RETRO_SPECULAR =
  'vec3 retroSpecularBRDF = godotSpecularBRDF( directLight.direction, retroViewDir, geometryNormal, material, godotSizeOffset );';

const THREE_ALPHA_T =
  'material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );';

/**
 * Godot stretches the lobe by an aspect ratio of the signed `anisotropy` (`scene_forward_lights_inc.glsl:242-245`).
 * Godot turns the frame by the flowmap only above 0.01 (`scene_forward_clustered.glsl:1456-1461`).
 */
const GODOT_ALPHAS = /* glsl */ `float godotAnisotropy = GODOT_ANISOTROPY_IS_NEGATIVE ? - material.anisotropy : material.anisotropy;
	if ( godotAnisotropy <= 0.01 ) anisotropyV = vec2( 1.0, 0.0 );
	float godotAspect = sqrt( 1.0 - godotAnisotropy * 0.9 );
	material.alphaT = pow2( material.godotRoughness ) / godotAspect;
	material.godotAlphaB = pow2( material.godotRoughness ) * godotAspect;`;

/**
 * The sign `threeAnisotropy` turns into the frame. Godot bends an anisotropic reflection about the
 * bitangent, or the tangent when `anisotropy` is negative (`scene_forward_clustered.glsl:1698`).
 */
const ANISOTROPY_SIGN = /* glsl */ `#define GODOT_ANISOTROPY_IS_NEGATIVE ( anisotropyVector.x < 0.0 )
#define GODOT_IBL_ANISOTROPIC_DIRECTION ( GODOT_ANISOTROPY_IS_NEGATIVE ? material.anisotropyT : material.anisotropyB )
`;

const THREE_IBL_RADIANCE =
  'vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );';
const THREE_IBL_RETRO_RADIANCE =
  'vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );';

/** The edit that bends an anisotropic reflection line about Godot's direction. */
const IBL_DIRECTION_EDIT: TextEdit = {
  three: 'material.anisotropyB',
  godot: 'GODOT_IBL_ANISOTROPIC_DIRECTION',
};

/**
 * The anisotropic reflection also on Godot's roughness, which `godotIBLRadiance`
 * (`godotSkyLighting.ts`) reads as the isotropic one does.
 */
const GODOT_IBL_RADIANCE = editedShader(
  THREE_IBL_RADIANCE,
  [IBL_DIRECTION_EDIT, { three: 'material.roughness', godot: 'material.godotRoughness' }],
  'three’s anisotropic reflection line'
);
const GODOT_IBL_RETRO_RADIANCE = editedShader(
  THREE_IBL_RETRO_RADIANCE,
  [IBL_DIRECTION_EDIT],
  'three’s anisotropic retroreflection line'
);

type LightChunk = typeof CHUNK | typeof SETUP_CHUNK | typeof MAPS_CHUNK;

/**
 * Each edit to three's chunks: Godot's roughness and anisotropic alphas beside three's, Godot's
 * light terms, Godot's direct specular in its mode, each diffuse line without its Fresnel weight,
 * and the anisotropic reflection bent about Godot's direction.
 */
const GODOT_LIGHT_FUNCTION_EDITS: readonly ChunkEdit<LightChunk>[] = [
  {
    chunk: CHUNK,
    three: MATERIAL_STRUCT,
    godot: `${MATERIAL_STRUCT}\n\tfloat godotRoughness;\n\tfloat godotAlphaB;`,
  },
  { chunk: SETUP_CHUNK, three: ROUGHNESS_SETUP, godot: GODOT_ROUGHNESS },
  { chunk: CHUNK, three: RE_DIRECT, godot: `${ANISOTROPY_SIGN}${DIFFUSE_NL}${SPECULAR_BRDF}${RE_DIRECT}` },
  { chunk: CHUNK, three: THREE_IRRADIANCE_NL, godot: IRRADIANCE_NL },
  { chunk: CHUNK, three: THREE_DIRECT_SPECULAR, godot: DIRECT_SPECULAR },
  { chunk: CHUNK, three: THREE_RETRO_SPECULAR, godot: RETRO_SPECULAR },
  { chunk: CHUNK, three: THREE_SPECULAR_SUM, godot: SPECULAR_SUM },
  { chunk: SETUP_CHUNK, three: THREE_ALPHA_T, godot: GODOT_ALPHAS },
  { chunk: MAPS_CHUNK, three: THREE_IBL_RADIANCE, godot: GODOT_IBL_RADIANCE },
  {
    chunk: MAPS_CHUNK,
    three: THREE_IBL_RETRO_RADIANCE,
    godot: GODOT_IBL_RETRO_RADIANCE,
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
  {
    chunk: CHUNK,
    three: 'vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );',
    godot: 'vec3 diffuse = material.diffuseContribution;',
  },
];

/**
 * Installs the light specular, light size and normal map read patches it reads, then replaces
 * three's chunks, for every program compiled after the call. A three release that rewrites the
 * lines keeps its own chunk, and `godotLightFunction.test.ts` fails on that release. True when the
 * chunks hold the patch after the call. A second call changes nothing, whatever other patches have
 * changed since.
 */
export function installGodotLightFunction(): boolean {
  if (!(installGodotLightSpecular() && installGodotLightSize() && installGodotNormalMapRead())) return false;
  return installChunkEdits({
    edits: GODOT_LIGHT_FUNCTION_EDITS,
    // One sentinel, as the other patches check: they may edit next to this patch's lines.
    mark: DIFFUSE_NL,
    patch: 'light function',
  });
}

/**
 * three's anisotropy props for Godot's signed `anisotropy`. three takes a magnitude, so a negative
 * one turns the frame by π, which three's D, V and reflection never see: they read T and B squared
 * or crossed twice. The patched chunks read the sign off `anisotropyVector`, so both signs share one
 * program.
 */
export function threeAnisotropy(anisotropy: number): { anisotropy: number; anisotropyRotation: number } {
  return { anisotropy: Math.abs(anisotropy), anisotropyRotation: anisotropy < 0 ? Math.PI : 0 };
}
