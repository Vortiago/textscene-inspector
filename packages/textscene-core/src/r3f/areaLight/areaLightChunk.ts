/**
 * Godot 4.7.2's area light in three's rect area light chunks: `light_process_area`
 * (`scene_forward_lights_inc.glsl:958-1312`) in place of three's clipped-sphere approximation, on
 * Godot's LTC tables. Each light's facing, range, attenuation and specular amount reach the program
 * through `areaLightFalloff.ts`.
 */

/*
 * The light function is derived from Godot Engine (`servers/rendering/renderer_rd/shaders/
 * scene_forward_lights_inc.glsl`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

import {
  applyChunkEdits,
  installChunkPatch,
  type ChunkEdit,
  type Chunks,
} from '../shaderPatch/chunkPatch.js';
import { installLitUniform } from '../shaderPatch/litUniform.js';
import { LTC_INTEGRAL } from './ltcIntegral.js';
import { installLtcTextures } from './ltcTextures.js';
import { AREA_LIGHT_FACINGS, AREA_LIGHT_FALLOFFS, areaLightUniformValues } from './areaLightFalloff.js';

type AreaLightChunkName = 'lights_pars_begin' | 'lights_physical_pars_fragment' | 'lights_fragment_begin';

/**
 * `light_process_area` without its shadow and `area_texture` (4.7.2 `scene_forward_lights_inc.glsl:983-1003`,
 * `:1123-1150`, `:1214-1310`), in the material's `diffuse_mode` and `specular_mode`. `facing` is the
 * view-space direction the light shines in, and `falloff` its range, attenuation and specular amount.
 * three's light colour carries Godot's `energy * PI`, divided by the area when the light normalises it.
 * `getDistanceAttenuation` carries Godot's `get_omni_attenuation` (`godotLightAttenuation.ts`).
 */
const AREA_LIGHT = /* glsl */ `
void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 facing, const in vec3 falloff, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 areaWidth = 2.0 * rectAreaLight.halfWidth;
	vec3 areaHeight = 2.0 * rectAreaLight.halfHeight;
	if ( dot( areaWidth, areaWidth ) < 1e-7 || dot( areaHeight, areaHeight ) < 1e-7 ) return;
	vec3 lightToVertex = geometryPosition - rectAreaLight.position;
	if ( dot( facing, lightToVertex ) <= 0.0 ) return;

	float widthLength = length( areaWidth );
	float heightLength = length( areaHeight );
	float halfWidthLength = widthLength / 2.0;
	float halfHeightLength = heightLength / 2.0;
	vec3 local = vec3( dot( lightToVertex, normalize( areaWidth ) ), dot( lightToVertex, normalize( areaHeight ) ), dot( lightToVertex, - facing ) );
	vec3 closest = vec3( clamp( local.x, - halfWidthLength, halfWidthLength ), clamp( local.y, - halfHeightLength, halfHeightLength ), 0.0 );
	float lightDistance = max( 0.0, length( closest - local ) );
	// Godot's clusters skip a fragment beyond the range, where the attenuation is zero.
	if ( lightDistance >= falloff.x ) return;
	vec3 light = rectAreaLight.color * getDistanceAttenuation( lightDistance, falloff.x, falloff.y );
	// The integral's solid angle already falls with the square of the distance (:1003).
	vec3 ltcLight = light * lightDistance * lightDistance;
	float area = widthLength * heightLength;
	float specularAmount = falloff.z;

	vec3 points[ 4 ];
	points[ 0 ] = rectAreaLight.position - rectAreaLight.halfWidth - rectAreaLight.halfHeight - geometryPosition;
	points[ 1 ] = rectAreaLight.position + rectAreaLight.halfWidth - rectAreaLight.halfHeight - geometryPosition;
	points[ 2 ] = rectAreaLight.position + rectAreaLight.halfWidth + rectAreaLight.halfHeight - geometryPosition;
	points[ 3 ] = rectAreaLight.position - rectAreaLight.halfWidth + rectAreaLight.halfHeight - geometryPosition;

	float diffuse = godotLtcIntegral( geometryNormal, geometryViewDir, mat3( 1.0 ), points );
	#ifndef GODOT_SPECULAR_DISABLED
		vec2 ltcFresnel;
		float specular = godotLtcSpecular( geometryNormal, geometryViewDir, material.godotRoughness, points, ltcFresnel );
	#endif
	#if defined( GODOT_DIFFUSE_TOON ) || defined( GODOT_SPECULAR_TOON )
		float solidAngleOverPi = max( godotQuadSolidAngle( points ), 0.001 ) / PI;
	#endif

	// Godot 4.7.2 dims this light under the clearcoat by the coat's own Fresnel (:1262-1269).
	float clearcoatAttenuation = 1.0;
	#ifdef USE_CLEARCOAT
		vec2 clearcoatLtcFresnel;
		float clearcoatSpecular = godotLtcSpecular( geometryClearcoatNormal, geometryViewDir, sqrt( mix( 0.001, 0.1, material.clearcoatRoughness ) ), points, clearcoatLtcFresnel );
		float clearcoatFresnel = 0.04 * max( clearcoatLtcFresnel.x, 0.0 ) + ( 1.0 - 0.04 ) * max( clearcoatLtcFresnel.y, 0.0 );
		clearcoatAttenuation = 1.0 - clearcoatFresnel * material.clearcoat;
		clearcoatSpecularDirect += clearcoatSpecular * clearcoatFresnel * ltcLight * specularAmount;
	#endif

	#ifdef GODOT_DIFFUSE_TOON
		float backDiffuse = godotLtcIntegral( - geometryNormal, geometryViewDir, mat3( 1.0 ), points );
		float NdotL = ( diffuse - backDiffuse ) / solidAngleOverPi;
		float diffuseNL = smoothstep( - material.godotRoughness, max( material.godotRoughness, 0.01 ), NdotL ) * RECIPROCAL_PI;
		reflectedLight.directDiffuse += diffuseNL * light * area * clearcoatAttenuation * material.diffuseContribution;
	#else
		reflectedLight.directDiffuse += diffuse * ltcLight * clearcoatAttenuation * material.diffuseContribution;
	#endif

	// Toon writes to the diffuse, which Godot scales by albedo and 1 - metallic.
	#if defined( GODOT_SPECULAR_TOON )
		float mid = pow2( 1.0 - material.godotRoughness );
		float RdotV = specular / solidAngleOverPi;
		float intensity = smoothstep( mid - material.godotRoughness * 0.5, mid + material.godotRoughness * 0.5, RdotV ) * mid;
		reflectedLight.directDiffuse += intensity * light * area * specularAmount * material.diffuseContribution;
	#elif !defined( GODOT_SPECULAR_DISABLED )
		vec3 f0 = material.specularColorBlended;
		float f90 = clamp( dot( f0, vec3( 50.0 * 0.33 ) ), material.metalness, 1.0 );
		vec3 fresnel = f0 * max( ltcFresnel.x, 0.0 ) + ( f90 - f0 ) * max( ltcFresnel.y, 0.0 );
		reflectedLight.directSpecular += specular * fresnel * ltcLight * specularAmount * clearcoatAttenuation;
	#endif
}
`;

/** three's area light function, from its signature to the `#endif` that closes its block. */
const THREE_AREA_LIGHT_START = '\tvoid RE_Direct_RectArea_Physical(';
const THREE_AREA_LIGHT_END = '\n#endif\n';

function withGodotAreaLight(chunk: string): string | null {
  const start = chunk.indexOf(THREE_AREA_LIGHT_START);
  const end = chunk.indexOf(THREE_AREA_LIGHT_END, start);
  if (start < 0 || end < 0 || chunk.split(THREE_AREA_LIGHT_START).length !== 2) return null;
  return `${chunk.slice(0, start)}${LTC_INTEGRAL}${AREA_LIGHT}${chunk.slice(end)}`;
}

const THREE_AREA_UNIFORM = 'uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];';
const THREE_AREA_CALL = 'RE_Direct_RectArea( rectAreaLight, geometryPosition,';

const UNIFORM_AND_CALL_EDITS: readonly ChunkEdit<AreaLightChunkName>[] = [
  {
    chunk: 'lights_pars_begin',
    three: THREE_AREA_UNIFORM,
    godot: `${THREE_AREA_UNIFORM}
	uniform vec3 ${AREA_LIGHT_FACINGS}[ NUM_RECT_AREA_LIGHTS ];
	uniform vec3 ${AREA_LIGHT_FALLOFFS}[ NUM_RECT_AREA_LIGHTS ];`,
  },
  {
    chunk: 'lights_fragment_begin',
    three: THREE_AREA_CALL,
    godot: `RE_Direct_RectArea( rectAreaLight, ${AREA_LIGHT_FACINGS}[ i ], ${AREA_LIGHT_FALLOFFS}[ i ], geometryPosition,`,
  },
];

/** The texts of the patches the area light reads: Godot's roughness and Godot's distance falloff. */
const GODOT_ROUGHNESS_FIELD = 'float godotRoughness;';
const GODOT_DISTANCE_FALLOFF = 'pow( max( lightDistance, 0.0001 ), - decayExponent )';

function areaLightChunks(chunks: Chunks<AreaLightChunkName>): Chunks<AreaLightChunkName> | null {
  if (!chunks.lights_physical_pars_fragment.includes(GODOT_ROUGHNESS_FIELD)) return null;
  if (!chunks.lights_pars_begin.includes(GODOT_DISTANCE_FALLOFF)) return null;
  const lightFunction = withGodotAreaLight(chunks.lights_physical_pars_fragment);
  if (lightFunction === null) return null;
  return applyChunkEdits({ ...chunks, lights_physical_pars_fragment: lightFunction }, UNIFORM_AND_CALL_EDITS);
}

/**
 * Replaces three's area light, and gives its tables and per-light uniforms to every built-in lit
 * material, for every program compiled after the call. It reads the light function's and the
 * attenuation's patches, so it installs after them. A three release that rewrites a replaced text
 * keeps all its own chunks, and `areaLightChunk.test.ts` fails on that release. A second call
 * changes nothing.
 */
export function installGodotAreaLight(): void {
  const isPatched = installChunkPatch({
    names: ['lights_pars_begin', 'lights_physical_pars_fragment', 'lights_fragment_begin'],
    isApplied: (chunks) => chunks.lights_physical_pars_fragment.includes('godotLtcIntegral('),
    apply: areaLightChunks,
    missing: 'rect area light lacks a text the Godot area light replaces, or a patch it reads',
  });
  if (!isPatched) return;
  installLtcTextures();
  const { facings, falloffs } = areaLightUniformValues();
  installLitUniform(AREA_LIGHT_FACINGS, facings);
  installLitUniform(AREA_LIGHT_FALLOFFS, falloffs);
}
