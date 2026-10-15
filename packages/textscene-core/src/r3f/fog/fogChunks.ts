/**
 * The GLSL every fog program and the background include: Godot's depth fog, its sun scatter and
 * aerial perspective, and the volumetric fog's volume, blended as Godot blends them before the tone
 * curve. `scene_forward_clustered.glsl` is `renderer_rd/shaders/forward_clustered/`, `sky.glsl` is
 * `renderer_rd/shaders/environment/`.
 */

import {
  AERIAL_PERSPECTIVE_ROUGHNESS_MIN,
  FOG_SUN_SCATTER_EXPONENT,
  FOG_SUN_SCATTER_MIN,
  FogMode,
  HEIGHT_FOG_DENSITY_MIN,
} from '../../godot/rendering/environment/depthFog.js';
import { MAX_DIRECTIONAL_LIGHTS } from '../../godot/rendering/lights/directionalShadow.js';
import { glslFloat } from '../../utils/glslLiterals.js';
import { FOG_RADIANCE_BANDS, FOG_RADIANCE_BAND_HEIGHT, FOG_UNIFORM as U } from './fogUniforms.js';

/** The chunk a shader includes for the fog's uniforms and functions. */
export const GODOT_FOG_PARS_CHUNK = 'godot_fog_pars_fragment';

/** The sky's directional lights, which the sky's fog reads (`sky.cpp:707`). */
const FOG_SKY_SUN_MAX = 4;

export const GODOT_FOG_PARS = /* glsl */ `
uniform highp sampler3D ${U.volume};
uniform vec4 ${U.volumeLookup};
uniform vec4 ${U.viewport};
uniform vec4 ${U.depthColor};
uniform vec4 ${U.depthShape};
uniform vec4 ${U.depthLayer};
uniform vec4 ${U.depthSky};
uniform vec4 ${U.sunDirections}[ ${MAX_DIRECTIONAL_LIGHTS} ];
uniform vec4 ${U.sunSurfaceColors}[ ${MAX_DIRECTIONAL_LIGHTS} ];
uniform vec4 ${U.sunSkyColors}[ ${MAX_DIRECTIONAL_LIGHTS} ];
uniform mat3 ${U.skyRotation};
uniform sampler2D ${U.radiance};

// Its own constants: the cube background includes no <common>.
const float FOG_INVERSE_PI = 0.3183098861837907;
const float FOG_INVERSE_TWO_PI = 0.15915494309189535;

vec2 fogScreenUv() {
	return ( gl_FragCoord.xy - ${U.viewport}.xy ) * ${U.viewport}.zw;
}

// The volume's sample in front of a surface at view depth viewDepth (scene_forward_clustered.glsl:1091-1099).
vec4 volumetricFogAtDepth( float viewDepth ) {
	vec3 position = vec3( fogScreenUv(), viewDepth * ${U.volumeLookup}.x );
	if ( position.z < 0.0 ) return vec4( 0.0, 0.0, 0.0, 1.0 );
	if ( position.z < 1.0 ) position.z = pow( position.z, ${U.volumeLookup}.y );
	return texture( ${U.volume}, position );
}

// The radiance atlas's band for a roughness, read along a world direction and blended between bands.
vec3 fogRadianceAt( vec3 worldDirection, float roughness ) {
	vec3 skyDirection = normalize( ${U.skyRotation} * worldDirection );
	float u = atan( skyDirection.z, skyDirection.x ) * FOG_INVERSE_TWO_PI + 0.5;
	float halfTexel = 0.5 / ${glslFloat(FOG_RADIANCE_BAND_HEIGHT)};
	float v = clamp( asin( clamp( skyDirection.y, - 1.0, 1.0 ) ) * FOG_INVERSE_PI + 0.5, halfTexel, 1.0 - halfTexel );
	float band = clamp( roughness * ${glslFloat(FOG_RADIANCE_BANDS)} - 1.0, 0.0, ${glslFloat(FOG_RADIANCE_BANDS - 1)} );
	float lower = floor( band );
	float upper = min( lower + 1.0, ${glslFloat(FOG_RADIANCE_BANDS - 1)} );
	vec3 a = texture( ${U.radiance}, vec2( u, ( lower + v ) / ${glslFloat(FOG_RADIANCE_BANDS)} ) ).rgb;
	vec3 b = texture( ${U.radiance}, vec2( u, ( upper + v ) / ${glslFloat(FOG_RADIANCE_BANDS)} ) ).rgb;
	return mix( a, b, band - lower );
}

// How much of sun i's glow a view along direction sees.
float fogSunAmount( vec3 direction, int i ) {
	return pow( max( dot( direction, ${U.sunDirections}[ i ].xyz ), 0.0 ), ${glslFloat(FOG_SUN_SCATTER_EXPONENT)} );
}

// Each surface light's glow towards it (scene_forward_clustered.glsl:1126-1136).
vec3 fogSurfaceSunScatter( vec3 worldDirection ) {
	vec3 scatter = vec3( 0.0 );
	for ( int i = 0; i < ${MAX_DIRECTIONAL_LIGHTS}; i ++ ) scatter += ${U.sunSurfaceColors}[ i ].rgb * fogSunAmount( worldDirection, i );
	return scatter * ${U.depthSky}.y;
}

// The same glow in the sky, from the first sky lights, along the sky-space view (sky.glsl:164-172).
vec3 fogSkySunScatter( vec3 skyDirection ) {
	vec3 scatter = vec3( 0.0 );
	int lights = 0;
	for ( int i = 0; i < ${MAX_DIRECTIONAL_LIGHTS}; i ++ ) {
		if ( ${U.sunSkyColors}[ i ].a == 0.0 ) continue;
		if ( lights == ${FOG_SKY_SUN_MAX} ) break;
		lights ++;
		scatter += ${U.sunSkyColors}[ i ].rgb * fogSunAmount( skyDirection, i );
	}
	return scatter * ${U.depthSky}.y;
}

// The depth fog's colour and amount at a view-space position (scene_forward_clustered.glsl:1102-1164).
vec4 depthFogAt( vec3 view ) {
	vec3 worldView = transpose( mat3( viewMatrix ) ) * view;
	vec3 worldDirection = normalize( worldView );
	vec3 color = ${U.depthColor}.rgb;
	float aerial = ${U.depthLayer}.w;
	if ( aerial > 0.0 ) {
		float near = ${U.depthSky}.z;
		float far = ${U.depthSky}.w;
		float roughness = mix( ${glslFloat(AERIAL_PERSPECTIVE_ROUGHNESS_MIN)}, 1.0, 1.0 - ( abs( view.z ) - near ) / ( far - near ) );
		color = mix( color, fogRadianceAt( worldDirection, roughness ), aerial );
	}
	if ( ${U.depthSky}.y > ${glslFloat(FOG_SUN_SCATTER_MIN)} ) color += fogSurfaceSunScatter( worldDirection );
	float distance = length( view );
	float amount;
	if ( ${U.depthLayer}.x == ${glslFloat(FogMode.DEPTH)} ) {
		float depth = smoothstep( ${U.depthShape}.y, ${U.depthShape}.z, distance );
		amount = pow( depth, ${U.depthShape}.w ) * ${U.depthShape}.x;
	} else {
		amount = 1.0 - exp( min( 0.0, - distance * ${U.depthShape}.x ) );
	}
	float heightDensity = ${U.depthLayer}.z;
	if ( abs( heightDensity ) >= ${glslFloat(HEIGHT_FOG_DENSITY_MIN)} ) {
		float worldHeight = worldView.y + cameraPosition.y;
		float heightAmount = 1.0 - exp( min( 0.0, ( worldHeight - ${U.depthLayer}.y ) * heightDensity ) );
		amount = max( heightAmount, amount );
	}
	return vec4( color, amount );
}

// The volume over the fog in front of it, premultiplied, with its transmittance in alpha
// (scene_forward_clustered.glsl:1488-1527). Legacy blending is Godot 4.0's composite.
vec4 godotFogAt( vec3 view ) {
	vec4 fog = vec4( 0.0, 0.0, 0.0, 1.0 );
	if ( ${U.depthColor}.a > 0.0 ) {
		vec4 depth = depthFogAt( view );
		fog = vec4( depth.rgb * depth.a, 1.0 - depth.a );
	}
	if ( ${U.volumeLookup}.x > 0.0 ) {
		vec4 volume = volumetricFogAtDepth( - view.z );
		vec3 rgb = ${U.volumeLookup}.w > 0.5 ? mix( volume.rgb, fog.rgb, volume.a ) : fog.rgb * volume.a + volume.rgb;
		fog = vec4( rgb, fog.a * volume.a );
	}
	return fog;
}

// The sky under both fogs, after its brightness (sky.glsl:281-295).
vec3 godotSkyFog( vec3 color, vec3 worldDirection ) {
	if ( ${U.depthColor}.a > 0.0 ) {
		vec3 skyDirection = normalize( ${U.skyRotation} * worldDirection );
		vec3 fogColor = mix( ${U.depthColor}.rgb, color, ${U.depthLayer}.w );
		if ( ${U.depthSky}.y > ${glslFloat(FOG_SUN_SCATTER_MIN)} ) fogColor += fogSkySunScatter( skyDirection );
		color = mix( color, fogColor, ${U.depthSky}.x );
	}
	if ( ${U.volumeLookup}.x > 0.0 ) {
		vec4 volume = texture( ${U.volume}, vec3( fogScreenUv(), 1.0 ) );
		if ( ${U.volumeLookup}.w > 0.5 ) {
			color = mix( color, volume.rgb, ( 1.0 - volume.a ) * ${U.volumeLookup}.z );
		} else {
			color = mix( color, color * volume.a + volume.rgb, ${U.volumeLookup}.z );
		}
	}
	return color;
}
`;
