/**
 * Godot 4.6.3's clearcoat in three's physical lighting: the coat's lobe under an omni, spot or
 * directional light, its reflection of the sky, its raw roughness, and how it layers over the light
 * beneath. three dims every light under the coat. Godot dims only the ambient light and the
 * reflection, and only while the sky gives one (`scene_forward_clustered.glsl:1764-1795`). The area
 * light dims its own light (`areaLight/areaLightChunk.ts`). The coat's reflection joins the base
 * reflection, so three's own term for it stays empty.
 */

import {
  applyChunkEdits,
  installChunkPatch,
  type ChunkEdit,
  type TextEdit,
} from './shaderPatch/chunkPatch.js';
import { LIGHT_FUNCTION_MARK, RE_DIRECT } from './godotLightFunction.js';
import { SKY_LIGHTING_MARK, THREE_IBL_RADIANCE_FUNCTION } from './godotSkyLighting.js';

type ClearcoatChunk =
  | 'lights_physical_fragment'
  | 'lights_physical_pars_fragment'
  | 'lights_fragment_maps'
  | 'lights_fragment_end'
  | 'envmap_physical_pars_fragment';

/**
 * Godot's `Fc` without the `clearcoat` that three's layering multiplies in: Schlick at 4%
 * reflectance on the coat's normal, which ignores the normal map (`:1767-1770`).
 */
const CLEARCOAT_FRESNEL = /* glsl */ `
float godotClearcoatFresnel( const in vec3 normal, const in vec3 viewDir ) {
	return 0.04 + 0.96 * godotSchlickFresnel( max( dot( normal, viewDir ), 0.0001 ) );
}
`;

/**
 * Godot's coat lobe under a light (`scene_forward_lights_inc.glsl:173-185`) without the N.L, which
 * three's irradiance carries, nor `clearcoat`. Its D_GGX reads the alpha mix( 0.001, 0.1, roughness ).
 */
const CLEARCOAT_BRDF = /* glsl */ `
float godotClearcoatBRDF( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
	vec3 halfDir = normalize( viewDir + lightDir );
	float cLdotH = saturate( dot( lightDir, halfDir ) );
	float ccNdotH = saturate( dot( normal, halfDir ) );
	float Dr = godotGGXDistribution( ccNdotH, mix( 0.001, 0.1, roughness ) );
	float Gr = 0.25 / ( cLdotH * cLdotH + 1e-4 );
	float Fr = mix( 0.04, 1.0, godotSchlickFresnel( cLdotH ) );
	return Gr * Fr * Dr;
}

`;

/**
 * Godot's coat lobe takes the N.L of the surface's own normal (`:168`), not the coat's, as Godot
 * computes the coat's N.L and leaves it unused. It scales by the light's specular amount (`:185`).
 */
const DIRECT_CLEARCOAT = /* glsl */ `clearcoatSpecularDirect += irradiance * godotClearcoatBRDF( directLight.direction, geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness ) * godotSpecularAmount;`;

/**
 * Godot's reflection on the coat (`scene_forward_clustered.glsl:1768-1795`): about the coat's
 * normal, dimmed below the surface's horizon, from radiance layer mix( 0.001, 0.1, sqrt( roughness ) )
 * times the last layer's index. That layer is below 1, so the PMREM alone holds it, read at the
 * roughness whose square root is that fraction.
 */
const CLEARCOAT_RADIANCE = /* glsl */ `vec3 godotClearcoatRadiance( const in vec3 viewDir, const in vec3 clearcoatNormal, const in vec3 normal, const in float roughness ) {

		float horizon;
		vec3 reflectVec = godotReflection( viewDir, clearcoatNormal, normal, roughness, horizon );
		return godotPmremLayer( reflectVec, pow2( mix( 0.001, 0.1, sqrt( roughness ) ) ) ) * envMapIntensity * horizon * horizon;

	}

	`;

const THREE_INDIRECT_SPECULAR =
  'RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

/**
 * Godot dims the ambient light and the reflection by `Fc`, then adds the coat's reflection to the
 * reflection (`scene_forward_clustered.glsl:1771-1795`), which its base layer's weights then scale
 * (`:2221-2231`). It does so only while the sky gives a reflection, which three's `USE_ENVMAP` marks.
 */
const GODOT_INDIRECT_UNDER_COAT = /* glsl */ `#if defined( USE_CLEARCOAT ) && defined( USE_ENVMAP )
		float godotCoatFresnel = material.clearcoat * godotClearcoatFresnel( geometryClearcoatNormal, geometryViewDir );
		radiance = mix( radiance, clearcoatRadiance, godotCoatFresnel );
	#endif
	${THREE_INDIRECT_SPECULAR}
	#if defined( USE_CLEARCOAT ) && defined( USE_ENVMAP )
		reflectedLight.indirectDiffuse *= 1.0 - godotCoatFresnel;
	#endif`;

const CLEARCOAT_EDITS: readonly ChunkEdit<ClearcoatChunk>[] = [
  {
    chunk: 'lights_physical_fragment',
    three: 'material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );',
    godot: '',
  },
  {
    chunk: 'lights_physical_fragment',
    three: 'material.clearcoatRoughness += geometryRoughness;',
    godot: '',
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three: RE_DIRECT,
    godot: `${CLEARCOAT_FRESNEL}${CLEARCOAT_BRDF}${RE_DIRECT}`,
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three: 'float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );',
    godot: '',
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three: 'vec3 ccIrradiance = dotNLcc * directLight.color;',
    godot: '',
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three:
      'clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );',
    godot: DIRECT_CLEARCOAT,
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three:
      'clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );',
    godot: '',
  },
  {
    chunk: 'envmap_physical_pars_fragment',
    three: THREE_IBL_RADIANCE_FUNCTION,
    godot: `${CLEARCOAT_RADIANCE}${THREE_IBL_RADIANCE_FUNCTION}`,
  },
  {
    chunk: 'lights_fragment_maps',
    three:
      'clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );',
    godot:
      'clearcoatRadiance += godotClearcoatRadiance( geometryViewDir, geometryClearcoatNormal, geometryNormal, material.clearcoatRoughness );',
  },
  { chunk: 'lights_fragment_end', three: THREE_INDIRECT_SPECULAR, godot: GODOT_INDIRECT_UNDER_COAT },
];

/**
 * Godot adds the coat's lobe under each light and dims no light beneath it. The layering lives in
 * the physical material's own fragment shader, not in an include. three's build drops the blank
 * lines between its lines, so each edit is one line.
 */
const LAYERING_EDITS: readonly TextEdit[] = [
  { three: 'float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );', godot: '' },
  { three: 'vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );', godot: '' },
  {
    three:
      'outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;',
    godot: 'outgoingLight += clearcoatSpecularDirect * material.clearcoat;',
  },
];

/**
 * Replaces three's clearcoat for every program compiled after the call. It calls the light
 * function's and the sky lighting's functions, so it installs after them. A three release that
 * rewrites a replaced line keeps all its own text and warns, and `godotClearcoat.test.ts` fails on
 * that release. A second call changes nothing.
 */
export function installGodotClearcoat(): void {
  installChunkPatch({
    names: [
      'lights_physical_fragment',
      'lights_physical_pars_fragment',
      'lights_fragment_maps',
      'lights_fragment_end',
      'envmap_physical_pars_fragment',
    ],
    isApplied: (chunks) => chunks.lights_physical_pars_fragment.includes(CLEARCOAT_BRDF),
    apply: (chunks) => applyChunkEdits(chunks, CLEARCOAT_EDITS),
    fragmentShaders: { physical: LAYERING_EDITS },
    missing: 'lighting chunks or physical fragment shader lack a line the clearcoat patch replaces',
    requires: {
      lights_physical_pars_fragment: LIGHT_FUNCTION_MARK,
      envmap_physical_pars_fragment: SKY_LIGHTING_MARK,
    },
  });
}
