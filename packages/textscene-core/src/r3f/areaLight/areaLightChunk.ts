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
 * `get_omni_attenuation` (`scene_forward_lights_inc.glsl:457-464`) times the squared distance, as
 * the integral's solid angle already falls with the square (`:1003`).
 */
const ATTENUATION = /* glsl */ `
float godotAreaAttenuation( const in float lightDistance, const in float inverseRange, const in float decay ) {
	float nd = lightDistance * inverseRange;
	nd *= nd;
	nd *= nd;
	nd = max( 1.0 - nd, 0.0 );
	nd *= nd;
	return nd * pow( max( lightDistance, 0.0001 ), - decay ) * lightDistance * lightDistance;
}
`;

/**
 * `light_process_area` without its shadow and `area_texture` (`scene_forward_lights_inc.glsl:983-1003`,
 * `:1123-1150`, `:1262-1310`). `facing` is the view-space direction the light shines in, and
 * `falloff` its inverse range, attenuation and specular amount. three's light colour carries
 * Godot's `energy * PI`, divided by the area when the light normalises it. Clearcoat adds to three's
 * clearcoat term, which three layers over the base as it does for every light.
 */
const AREA_LIGHT = /* glsl */ `
void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 facing, const in vec3 falloff, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 areaWidth = 2.0 * rectAreaLight.halfWidth;
	vec3 areaHeight = 2.0 * rectAreaLight.halfHeight;
	if ( dot( areaWidth, areaWidth ) < 1e-7 || dot( areaHeight, areaHeight ) < 1e-7 ) return;
	vec3 lightToVertex = geometryPosition - rectAreaLight.position;
	if ( dot( facing, lightToVertex ) <= 0.0 ) return;

	float halfWidthLength = length( areaWidth ) / 2.0;
	float halfHeightLength = length( areaHeight ) / 2.0;
	vec3 local = vec3( dot( lightToVertex, normalize( areaWidth ) ), dot( lightToVertex, normalize( areaHeight ) ), dot( lightToVertex, - facing ) );
	vec3 closest = vec3( clamp( local.x, - halfWidthLength, halfWidthLength ), clamp( local.y, - halfHeightLength, halfHeightLength ), 0.0 );
	float lightDistance = max( 0.0, length( closest - local ) );
	// Godot's clusters skip a fragment beyond the range, where the attenuation is zero.
	if ( lightDistance * falloff.x >= 1.0 ) return;
	vec3 light = rectAreaLight.color * godotAreaAttenuation( lightDistance, falloff.x, falloff.y );

	vec3 points[ 4 ];
	points[ 0 ] = rectAreaLight.position - rectAreaLight.halfWidth - rectAreaLight.halfHeight - geometryPosition;
	points[ 1 ] = rectAreaLight.position + rectAreaLight.halfWidth - rectAreaLight.halfHeight - geometryPosition;
	points[ 2 ] = rectAreaLight.position + rectAreaLight.halfWidth + rectAreaLight.halfHeight - geometryPosition;
	points[ 3 ] = rectAreaLight.position - rectAreaLight.halfWidth + rectAreaLight.halfHeight - geometryPosition;

	float diffuse = godotLtcIntegral( geometryNormal, geometryViewDir, mat3( 1.0 ), points );
	reflectedLight.directDiffuse += diffuse * light * material.diffuseContribution;

	vec2 ltcFresnel;
	float specular = godotLtcSpecular( geometryNormal, geometryViewDir, material.roughness, points, ltcFresnel );
	vec3 f0 = material.specularColorBlended;
	float f90 = clamp( dot( f0, vec3( 50.0 * 0.33 ) ), material.metalness, 1.0 );
	vec3 fresnel = f0 * max( ltcFresnel.x, 0.0 ) + ( f90 - f0 ) * max( ltcFresnel.y, 0.0 );
	reflectedLight.directSpecular += specular * fresnel * light * falloff.z;

	#ifdef USE_CLEARCOAT
		vec2 clearcoatLtcFresnel;
		float clearcoatSpecular = godotLtcSpecular( geometryClearcoatNormal, geometryViewDir, sqrt( mix( 0.001, 0.1, material.clearcoatRoughness ) ), points, clearcoatLtcFresnel );
		float clearcoatFresnel = 0.04 * max( clearcoatLtcFresnel.x, 0.0 ) + ( 1.0 - 0.04 ) * max( clearcoatLtcFresnel.y, 0.0 );
		clearcoatSpecularDirect += clearcoatSpecular * clearcoatFresnel * light * falloff.z;
	#endif
}
`;

/** three's area light function, from its signature to the `#endif` that closes its block. */
const THREE_AREA_LIGHT_START = '\tvoid RE_Direct_RectArea_Physical(';
const THREE_AREA_LIGHT_END = '\n#endif\nvoid RE_Direct_Physical(';

function withGodotAreaLight(chunk: string): string | null {
  const start = chunk.indexOf(THREE_AREA_LIGHT_START);
  const end = chunk.indexOf(THREE_AREA_LIGHT_END);
  if (start < 0 || end < start || chunk.split(THREE_AREA_LIGHT_START).length !== 2) return null;
  return `${chunk.slice(0, start)}${LTC_INTEGRAL}${ATTENUATION}${AREA_LIGHT}${chunk.slice(end)}`;
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

function areaLightChunks(chunks: Chunks<AreaLightChunkName>): Chunks<AreaLightChunkName> | null {
  const lightFunction = withGodotAreaLight(chunks.lights_physical_pars_fragment);
  if (lightFunction === null) return null;
  return applyChunkEdits({ ...chunks, lights_physical_pars_fragment: lightFunction }, UNIFORM_AND_CALL_EDITS);
}

/**
 * Replaces three's area light, and gives its tables and per-light uniforms to every built-in lit
 * material, for every program compiled after the call. A three release that rewrites a replaced
 * text keeps all its own chunks, and `areaLightChunk.test.ts` fails on that release. A second call
 * changes nothing.
 */
export function installGodotAreaLight(): void {
  const isPatched = installChunkPatch({
    names: ['lights_pars_begin', 'lights_physical_pars_fragment', 'lights_fragment_begin'],
    isApplied: (chunks) => chunks.lights_physical_pars_fragment.includes('godotLtcIntegral('),
    apply: areaLightChunks,
    missing: 'rect area light lacks a text the Godot area light replaces',
  });
  if (!isPatched) return;
  installLtcTextures();
  const { facings, falloffs } = areaLightUniformValues();
  installLitUniform(AREA_LIGHT_FACINGS, facings);
  installLitUniform(AREA_LIGHT_FALLOFFS, falloffs);
}
