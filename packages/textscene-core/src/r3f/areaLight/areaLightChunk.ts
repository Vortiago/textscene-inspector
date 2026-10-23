/**
 * Godot 4.7.2's area light in three's rect area light chunks: `light_process_area`
 * (`scene_forward_lights_inc.glsl:958-1312`) in place of three's clipped-sphere approximation, on
 * Godot's LTC tables. Each light's facing, range, attenuation, specular amount and place in the
 * area light atlas reach the program through `areaLightFalloff.ts`, and its shadow through
 * `GODOT_AREA_SHADOW`, which the positional shadow lookups define (`positionalShadowChunk.ts`).
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

import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { LIGHT_FUNCTION_MARK, RE_DIRECT } from '../godotLightFunction.js';
import { LIGHT_ATTENUATION_MARK } from '../godotLightAttenuation.js';
import { LTC_INTEGRAL, LTC_SPECULAR } from './ltcIntegral.js';
import { installLtcTextures } from './ltcTextures.js';
import {
  AREA_LIGHT_FACINGS,
  AREA_LIGHT_FALLOFFS,
  AREA_LIGHT_TEXTURE_MIPMAPS,
  AREA_LIGHT_TEXTURE_RECTS,
  installAreaLightUniforms,
} from './areaLightFalloff.js';
import { installAreaLightAtlas } from './areaLightAtlas.js';

export type AreaLightChunkName =
  'lights_pars_begin' | 'lights_physical_pars_fragment' | 'lights_fragment_begin';

/**
 * `light_process_area` (4.7.2 `scene_forward_lights_inc.glsl:983-1003`, `:1112-1150`, `:1214-1310`),
 * in the material's `diffuse_mode` and `specular_mode`. `facing` is the view-space direction the
 * light shines in, `falloff` its range, attenuation and specular amount, `textureRect` and
 * `textureMipmaps` where its `area_texture` lies in the atlas, and `shadow` the light's shadow at
 * the fragment, which dims both of Godot's terms.
 * three's light colour carries Godot's `energy * PI`, divided by the area when the light normalises it.
 * `getDistanceAttenuation` carries Godot's `get_omni_attenuation` (`godotLightAttenuation.ts`).
 */
const AREA_LIGHT = /* glsl */ `
void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 facing, const in vec3 falloff, const in vec4 textureRect, const in float textureMipmaps, const in float shadow, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 areaWidth = 2.0 * rectAreaLight.halfWidth;
	vec3 areaHeight = 2.0 * rectAreaLight.halfHeight;
	if ( dot( areaWidth, areaWidth ) < 1e-7 || dot( areaHeight, areaHeight ) < 1e-7 ) return;
	vec3 lightToVertex = geometryPosition - rectAreaLight.position;
	if ( dot( facing, lightToVertex ) <= 0.0 ) return;

	float widthLength = length( areaWidth );
	float heightLength = length( areaHeight );
	float halfWidthLength = widthLength / 2.0;
	float halfHeightLength = heightLength / 2.0;
	vec3 local = vec3( dot( lightToVertex, areaWidth / widthLength ), dot( lightToVertex, areaHeight / heightLength ), dot( lightToVertex, - facing ) );
	vec3 closest = vec3( clamp( local.x, - halfWidthLength, halfWidthLength ), clamp( local.y, - halfHeightLength, halfHeightLength ), 0.0 );
	float lightDistance = max( 0.0, length( closest - local ) );
	// Godot's clusters skip a fragment beyond the range, where the attenuation is zero. A zero
	// range is a light without a falloff, which three's attenuation leaves unbounded.
	if ( falloff.x > 0.0 && lightDistance >= falloff.x ) return;
	vec3 light = rectAreaLight.color * getDistanceAttenuation( lightDistance, falloff.x, falloff.y );
	// The integral's solid angle already falls with the square of the distance (:1003).
	vec3 ltcLight = light * lightDistance * lightDistance;
	light *= shadow;
	ltcLight *= shadow;
	float area = widthLength * heightLength;
	float specularAmount = falloff.z;

	vec3 points[ 4 ];
	points[ 0 ] = rectAreaLight.position - rectAreaLight.halfWidth - rectAreaLight.halfHeight - geometryPosition;
	points[ 1 ] = rectAreaLight.position + rectAreaLight.halfWidth - rectAreaLight.halfHeight - geometryPosition;
	points[ 2 ] = rectAreaLight.position + rectAreaLight.halfWidth + rectAreaLight.halfHeight - geometryPosition;
	points[ 3 ] = rectAreaLight.position - rectAreaLight.halfWidth + rectAreaLight.halfHeight - geometryPosition;

	#if defined( GODOT_DIFFUSE_TOON )
		// A toon diffuse reads its texture at the light's closest point, so its integral fetches none.
		vec4 diffuseTextureRect = vec4( 0.0 );
	#else
		vec4 diffuseTextureRect = textureRect;
	#endif
	vec3 diffuseTexture;
	float diffuse = godotLtcIntegral( geometryNormal, geometryViewDir, mat3( 1.0 ), points, diffuseTextureRect, textureMipmaps, diffuseTexture );
	#ifndef GODOT_SPECULAR_DISABLED
		vec2 ltcFresnel;
		vec3 specularTexture;
		float specular = godotLtcSpecular( geometryNormal, geometryViewDir, material.godotRoughness, points, textureRect, textureMipmaps, ltcFresnel, specularTexture );
	#endif
	#if defined( GODOT_DIFFUSE_TOON ) || defined( GODOT_SPECULAR_TOON )
		float solidAngleOverPi = max( godotQuadSolidAngle( points ), 0.001 ) / PI;
	#endif

	// Godot 4.7.2 dims this light under the clearcoat by the coat's own Fresnel (:1262-1269).
	float clearcoatAttenuation = 1.0;
	#ifdef USE_CLEARCOAT
		vec2 clearcoatLtcFresnel;
		vec3 clearcoatTexture;
		float clearcoatSpecular = godotLtcSpecular( geometryClearcoatNormal, geometryViewDir, sqrt( mix( 0.001, 0.1, material.clearcoatRoughness ) ), points, textureRect, textureMipmaps, clearcoatLtcFresnel, clearcoatTexture );
		float clearcoatFresnel = 0.04 * max( clearcoatLtcFresnel.x, 0.0 ) + ( 1.0 - 0.04 ) * max( clearcoatLtcFresnel.y, 0.0 );
		clearcoatAttenuation = 1.0 - clearcoatFresnel * material.clearcoat;
		clearcoatSpecularDirect += clearcoatSpecular * clearcoatTexture * clearcoatFresnel * ltcLight * specularAmount;
	#endif

	#ifdef GODOT_DIFFUSE_TOON
		// A toon diffuse reads the texture at the light's closest point, the same from any normal (:1213-1221).
		vec3 isotropicTexture = vec3( 1.0 );
		if ( textureRect != vec4( 0.0 ) ) {
			float lod = godotAreaTextureLod( lightDistance / sqrt( area ) );
			vec2 closestUv = ( closest.xy + vec2( halfWidthLength, halfHeightLength ) ) / vec2( widthLength, heightLength );
			isotropicTexture = godotAreaTextureAt( vec2( 1.0 ) - closestUv, textureRect, lod, textureMipmaps );
		}
		vec3 backTexture;
		float backDiffuse = godotLtcIntegral( - geometryNormal, geometryViewDir, mat3( 1.0 ), points, vec4( 0.0 ), textureMipmaps, backTexture );
		float NdotL = ( diffuse - backDiffuse ) / solidAngleOverPi;
		float diffuseNL = godotDiffuseNL( NdotL, 0.0, 0.0, material.godotRoughness ) * RECIPROCAL_PI;
		reflectedLight.directDiffuse += diffuseNL * light * isotropicTexture * area * clearcoatAttenuation * material.diffuseContribution;
	#else
		reflectedLight.directDiffuse += diffuse * diffuseTexture * ltcLight * clearcoatAttenuation * material.diffuseContribution;
	#endif

	// Toon writes to the diffuse, which Godot scales by albedo and 1 - metallic.
	#if defined( GODOT_SPECULAR_TOON )
		float intensity = godotToonIntensity( specular / solidAngleOverPi, material.godotRoughness );
		reflectedLight.directDiffuse += intensity * specularTexture * light * area * specularAmount * material.diffuseContribution;
	#elif !defined( GODOT_SPECULAR_DISABLED )
		vec3 f0 = material.specularColorBlended;
		float f90 = clamp( dot( f0, vec3( 50.0 * 0.33 ) ), material.metalness, 1.0 );
		vec3 fresnel = f0 * max( ltcFresnel.x, 0.0 ) + ( f90 - f0 ) * max( ltcFresnel.y, 0.0 );
		reflectedLight.directSpecular += specular * specularTexture * fresnel * ltcLight * specularAmount * clearcoatAttenuation;
	#endif
}
`;

/** three's area light block, from the `#if` that opens it to the `#endif` that closes it. */
const THREE_AREA_LIGHT_IF = '#if NUM_RECT_AREA_LIGHTS > 0';
const THREE_AREA_LIGHT_START = `${THREE_AREA_LIGHT_IF}\n\tvoid RE_Direct_RectArea_Physical(`;
const THREE_AREA_LIGHT_END = '\n#endif\n';

const THREE_AREA_UNIFORM = 'uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];';
const THREE_AREA_CALL = 'RE_Direct_RectArea( rectAreaLight, geometryPosition,';
const THREE_AREA_LOOP = '#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )';

/**
 * A program without the positional shadow lookups reads every area light as lit. The lookup's index
 * is `UNROLLED_LOOP_INDEX`, which three writes into each copy of the unrolled loop, where it rewrites
 * only a bracketed `i` (r186 `WebGLProgram.js:297-298`).
 */
const UNSHADOWED_AREA_LIGHT = `#ifndef GODOT_AREA_SHADOW
	#define GODOT_AREA_SHADOW( index ) 1.0
#endif
`;

/**
 * three's area light block out, and Godot's in before the light function's own `RE_Direct_Physical`:
 * Godot's calls the light function's diffuse and toon terms, which the light function patch declares
 * just before it. Then the per-light uniforms, and the call that hands them on.
 */
const AREA_LIGHT_EDITS: readonly ChunkEdit<AreaLightChunkName>[] = [
  {
    chunk: 'lights_physical_pars_fragment',
    three: THREE_AREA_LIGHT_START,
    until: THREE_AREA_LIGHT_END,
    godot: '',
  },
  {
    chunk: 'lights_physical_pars_fragment',
    three: RE_DIRECT,
    godot: `${THREE_AREA_LIGHT_IF}\n${LTC_INTEGRAL}${LTC_SPECULAR}${AREA_LIGHT}#endif\n${RE_DIRECT}`,
  },
  {
    chunk: 'lights_pars_begin',
    three: THREE_AREA_UNIFORM,
    godot: `${THREE_AREA_UNIFORM}
	uniform vec3 ${AREA_LIGHT_FACINGS}[ NUM_RECT_AREA_LIGHTS ];
	uniform vec3 ${AREA_LIGHT_FALLOFFS}[ NUM_RECT_AREA_LIGHTS ];
	uniform vec4 ${AREA_LIGHT_TEXTURE_RECTS}[ NUM_RECT_AREA_LIGHTS ];
	uniform float ${AREA_LIGHT_TEXTURE_MIPMAPS}[ NUM_RECT_AREA_LIGHTS ];`,
  },
  {
    chunk: 'lights_fragment_begin',
    three: THREE_AREA_CALL,
    godot: `RE_Direct_RectArea( rectAreaLight, ${AREA_LIGHT_FACINGS}[ i ], ${AREA_LIGHT_FALLOFFS}[ i ], ${AREA_LIGHT_TEXTURE_RECTS}[ i ], ${AREA_LIGHT_TEXTURE_MIPMAPS}[ i ], receiveShadow ? GODOT_AREA_SHADOW( UNROLLED_LOOP_INDEX ) : 1.0, geometryPosition,`,
  },
  {
    chunk: 'lights_fragment_begin',
    three: THREE_AREA_LOOP,
    godot: `${UNSHADOWED_AREA_LIGHT}${THREE_AREA_LOOP}`,
  },
];

/**
 * Replaces three's area light, and gives its tables, the area light atlas and the per-light
 * uniforms to every built-in lit material, for every program compiled after the call. It reads the
 * light function's and the attenuation's patches, so it installs after them. A three release that
 * rewrites a replaced text keeps all its own chunks, and `areaLightChunk.test.ts` fails on that
 * release. A second call changes nothing.
 */
export function installGodotAreaLight(): void {
  const isPatched = installChunkEdits({
    edits: AREA_LIGHT_EDITS,
    mark: 'godotLtcIntegral(',
    patch: 'area light',
    requires: {
      lights_physical_pars_fragment: LIGHT_FUNCTION_MARK,
      lights_pars_begin: LIGHT_ATTENUATION_MARK,
    },
  });
  if (!isPatched) return;
  installLtcTextures();
  installAreaLightUniforms();
  installAreaLightAtlas();
}
