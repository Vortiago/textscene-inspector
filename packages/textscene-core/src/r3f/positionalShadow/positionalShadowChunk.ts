/**
 * Godot's receiver offsets in three r186's omni and spot shadow lookups. three moves the vertex a
 * fixed distance along the normal. Godot moves the lookup per fragment, by an amount that grows as
 * the surface turns from the light, and spends its depth bias in its own units
 * (`scene_forward_lights_inc.glsl:483-489`, `:586-595`, `:780-787`).
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';

/** One replacement: the chunk, three's text in it, and the text that takes its place. */
interface ChunkEdit {
  chunk: 'shadowmap_vertex' | 'shadowmap_pars_fragment' | 'lights_fragment_begin';
  three: string;
  godot: string;
}

/**
 * The lookup an omni light's shadow takes. The direction moves by the normal bias, and the distance
 * to the light shrinks by the depth bias without the normal offset (`:586-595`). A receiver nearer
 * the light than the bias reads as lit, as Godot's depth past 1 does.
 */
const OMNI_LOOKUP = `
		vec4 godotOmniShadowCoord( vec4 lightToFragment, vec3 viewNormal, float normalBias, float depthBias ) {
			float shadowLength = length( lightToFragment.xyz );
			vec3 shadowDir = lightToFragment.xyz / shadowLength;
			vec3 worldNormal = transformNormalByInverseViewMatrix( viewNormal, viewMatrix );
			vec3 offset = worldNormal * normalBias * ( 1.0 - abs( dot( worldNormal, shadowDir ) ) );
			return vec4( normalize( shadowDir + offset ) * max( shadowLength - depthBias, 0.0 ), 1.0 );
		}
`;

/**
 * The lookup a spot light's shadow takes: the receiver moves along the normal by the normal bias
 * times its distance to the light (`:780-783`). With three's shadow camera on Godot's near and far,
 * three's depth is one minus Godot's reversed depth, so Godot's bias before the divide is three's
 * bias subtracted before it (`:786-787`).
 */
/**
 * three's PCF for an omni light, with every tap compared at one distance from the light, as Godot's
 * paraboloid stores and compares (`:594-597`). three's cube stores depth along a face's axis, so one
 * depth for every tap, as three compares, sits at a different distance along each tap's direction.
 */
const OMNI_PCF = `	float godotOmniShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowRadius, vec4 lookup, float shadowCameraNear, float shadowCameraFar ) {
		float distanceToLight = length( lookup.xyz );
		vec3 absVec = abs( lookup.xyz );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar > 0.0 || viewSpaceZ - shadowCameraNear < 0.0 ) return 1.0;
		vec3 bd3D = lookup.xyz / distanceToLight;
		float texelSize = shadowRadius / shadowMapSize.x;
		vec3 absDir = abs( bd3D );
		vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
		tangent = normalize( cross( bd3D, tangent ) );
		vec3 bitangent = cross( bd3D, tangent );
		float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
		float shadow = 0.0;
		for ( int i = 0; i < 5; i ++ ) {
			vec2 disk = vogelDiskSample( i, 5, phi );
			vec3 tap = normalize( bd3D + ( tangent * disk.x + bitangent * disk.y ) * texelSize );
			vec3 absTap = abs( tap );
			float tapZ = max( max( absTap.x, absTap.y ), absTap.z ) * distanceToLight;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - tapZ ) ) / ( tapZ * ( shadowCameraFar - shadowCameraNear ) );
			#else
				float dp = ( shadowCameraFar * ( tapZ - shadowCameraNear ) ) / ( tapZ * ( shadowCameraFar - shadowCameraNear ) );
			#endif
			shadow += texture( shadowMap, vec4( tap, dp ) );
		}
		return mix( 1.0, shadow * 0.2, shadowIntensity );
	}
`;

const SPOT_LOOKUP = `
		vec4 godotSpotShadowCoord( vec4 shadowCoord, mat4 lightMatrix, vec3 viewToLight, vec3 viewNormal, float normalBias, float depthBias ) {
			float lightLength = length( viewToLight );
			float slope = 1.0 - abs( dot( viewNormal, viewToLight / lightLength ) );
			vec3 worldNormal = transformNormalByInverseViewMatrix( viewNormal, viewMatrix );
			vec4 coord = shadowCoord + lightMatrix * vec4( worldNormal * lightLength * normalBias * slope, 0.0 );
			#ifdef USE_REVERSED_DEPTH_BUFFER
				coord.z += depthBias;
			#else
				coord.z -= depthBias;
			#endif
			return coord;
		}
`;

/** Each edit, in the order the chunks are read. Each `three` text occurs once in its chunk. */
export const POSITIONAL_SHADOW_EDITS: readonly ChunkEdit[] = [
  {
    chunk: 'shadowmap_vertex',
    three: `			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;`,
    godot: `			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * worldPosition;`,
  },
  {
    chunk: 'shadowmap_vertex',
    three: `		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
`,
    godot: '',
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];`,
    // The vertex stage declares it highp, and a uniform's precision must match across stages.
    godot: `	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
	uniform highp mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];`,
    godot: `		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
${SPOT_LOOKUP}`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];`,
    godot: `		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
${OMNI_LOOKUP}`,
  },
  {
    chunk: 'shadowmap_pars_fragment',
    three: `	float getPointShadow( samplerCubeShadow shadowMap,`,
    godot: `${OMNI_PCF}
	float getPointShadow( samplerCubeShadow shadowMap,`,
  },
  {
    chunk: 'lights_fragment_begin',
    three: `		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;`,
    godot: `		#if defined( SHADOWMAP_TYPE_PCF )
		directLight.color *= ( directLight.visible && receiveShadow ) ? godotOmniShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowRadius, godotOmniShadowCoord( vPointShadowCoord[ i ], normal, pointLightShadow.shadowNormalBias, pointLightShadow.shadowBias ), pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#else
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, 0.0, pointLightShadow.shadowRadius, godotOmniShadowCoord( vPointShadowCoord[ i ], normal, pointLightShadow.shadowNormalBias, pointLightShadow.shadowBias ), pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif`,
  },
  {
    chunk: 'lights_fragment_begin',
    three:
      'getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] )',
    godot:
      'getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, 0.0, spotLightShadow.shadowRadius, godotSpotShadowCoord( vSpotLightCoord[ i ], spotLightMatrix[ i ], spotLight.position - geometryPosition, normal, spotLightShadow.shadowNormalBias, spotLightShadow.shadowBias ) )',
  },
];

type Chunks = Record<ChunkEdit['chunk'], string>;

/**
 * The chunks with every edit applied, or null when an edit's text is missing from its chunk or
 * occurs more than once.
 */
export function positionalShadowChunks(chunks: Chunks): Chunks | null {
  const patched = { ...chunks };
  for (const { chunk, three, godot } of POSITIONAL_SHADOW_EDITS) {
    if (patched[chunk].split(three).length !== 2) return null;
    patched[chunk] = patched[chunk].replace(three, () => godot);
  }
  return patched;
}

/**
 * Replaces three's chunks for every program compiled after the call. A three release that rewrites
 * any edited text keeps all its own chunks, and `positionalShadowChunk.test.ts` fails on that
 * release. A second call changes nothing.
 */
export function installGodotPositionalShadow(): void {
  const current: Chunks = {
    shadowmap_vertex: THREE.ShaderChunk.shadowmap_vertex,
    shadowmap_pars_fragment: THREE.ShaderChunk.shadowmap_pars_fragment,
    lights_fragment_begin: THREE.ShaderChunk.lights_fragment_begin,
  };
  if (current.lights_fragment_begin.includes('godotOmniShadowCoord(')) return;
  const patched = positionalShadowChunks(current);
  if (patched === null) {
    warn("[Shading] three's omni and spot shadow lookups lack a line the Godot offsets replace");
    return;
  }
  Object.assign(THREE.ShaderChunk, patched);
}
