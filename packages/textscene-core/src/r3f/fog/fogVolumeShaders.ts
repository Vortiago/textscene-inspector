/**
 * The fragment shaders of the fog volume's three passes, as Godot 4.6.3's compute passes run them
 * (`renderer_rd/shaders/environment/volumetric_fog_process.glsl`, cited as `.glsl:N`). Each draw
 * fills one slice of a 3D target, one fragment per froxel, so `gl_FragCoord.xy` is the froxel's
 * column. The volume's rows run bottom-up, as WebGL's fragments do, where Godot's run top-down.
 */

import { VOLUMETRIC_FOG_TEMPORAL_JITTERS } from '../../godot/volumetricFog.js';
import { HENYEY_GREENSTEIN_GLSL } from '../henyeyGreenstein.js';
import { FogLightKind } from './fogLights.js';

/** The offsets a still froxel samples and averages: Godot's 16 jitters, or its centre alone. */
export const FOG_SAMPLE_OFFSETS_MAX = VOLUMETRIC_FOG_TEMPORAL_JITTERS.length;

/**
 * Lights one froxel: each light's scatter (`.glsl:252-255`) and the ambient with its sky
 * (`.glsl:430-445`), times the albedo, plus the emission (`.glsl:681`). A moving camera's froxel
 * blends this frame's jitter into its reprojected history (`.glsl:311-335,683`). A still one
 * averages its sample offsets, the mean the history converges to. A clear cell scatters nothing (`.glsl:383`).
 */
export const FOG_LIGHT_FRAGMENT = /* glsl */ `
#include <common>
#include <cube_uv_reflection_fragment>

uniform vec3 gridSize;
uniform float slice;
uniform vec2 frustumBegin;
uniform vec2 frustumEnd;
uniform float fogLength;
uniform float detailSpread;
uniform float density;
uniform float litDensityMin;
uniform vec3 scattering;
uniform vec3 emission;
uniform float phaseG;
uniform vec3 ambientColor;
uniform float ambientInject;
uniform float skyContribution;
uniform float skyRoughness;
uniform float skyEnergy;
uniform mat3 viewToSky;
uniform highp sampler2D fogLights;
uniform int lightCount;
uniform vec3 sampleOffsets[${FOG_SAMPLE_OFFSETS_MAX}];
uniform int sampleCount;
uniform highp sampler3D history;
uniform mat4 toPreviousView;
uniform float historyAmount;

#ifdef ENVMAP_TYPE_CUBE_UV
	uniform sampler2D envMap;
#endif

${HENYEY_GREENSTEIN_GLSL}
// The falloff of omni and spot lights alike (.glsl:228-235).
float omniAttenuation( float range, float inverseRange, float decay ) {
	float nd = range * inverseRange;
	nd *= nd;
	nd *= nd;
	nd = max( 1.0 - nd, 0.0 );
	nd *= nd;
	return nd * pow( max( range, 0.0001 ), - decay );
}

// .glsl:304-309: the unit depth packs towards the camera before it spreads to the frustum.
vec3 froxelView( vec3 unit ) {
	float depth = pow( unit.z, detailSpread );
	vec2 halfExtents = mix( frustumBegin, frustumEnd, vec2( depth ) );
	return vec3( ( unit.xy * 2.0 - 1.0 ) * halfExtents, - fogLength * depth );
}

// .glsl:425, :511 and :550-575
vec3 lightsAt( vec3 view ) {
	vec3 eye = normalize( view );
	vec3 total = vec3( 0.0 );
	for ( int i = 0; i < lightCount; i ++ ) {
		vec4 position = texelFetch( fogLights, ivec2( 0, i ), 0 );
		vec4 color = texelFetch( fogLights, ivec2( 1, i ), 0 );
		vec4 direction = texelFetch( fogLights, ivec2( 2, i ), 0 );
		vec4 cone = texelFetch( fogLights, ivec2( 3, i ), 0 );
		int kind = int( cone.y );
		if ( kind == ${FogLightKind.DIRECTIONAL} ) {
			total += color.rgb * henyey_greenstein( dot( eye, direction.xyz ), phaseG );
			continue;
		}
		vec3 toLight = position.xyz - view;
		float range = length( toLight );
		if ( range * position.w >= 1.0 ) continue;
		float attenuation = omniAttenuation( range, position.w, color.w );
		if ( kind == ${FogLightKind.SPOT} ) {
			float spotCos = max( dot( - normalize( toLight ), direction.xyz ), direction.w );
			float rim = max( 0.0001, ( 1.0 - spotCos ) / ( 1.0 - direction.w ) );
			attenuation *= 1.0 - pow( rim, cone.x );
		}
		total += color.rgb * attenuation * henyey_greenstein( dot( normalize( toLight ), eye ), phaseG );
	}
	return total;
}

// .glsl:430-445: the isotropic sample reads the sky straight up, the anisotropic one along the view.
vec3 ambientAt( vec3 view ) {
	vec3 isotropic = vec3( 0.0 );
	vec3 anisotropic = vec3( 0.0 );
	#ifdef ENVMAP_TYPE_CUBE_UV
		if ( skyContribution > 0.0 ) {
			isotropic = textureCubeUV( envMap, vec3( 0.0, 1.0, 0.0 ), skyRoughness ).rgb;
			if ( phaseG != 0.0 ) {
				vec3 scatter = viewToSky * normalize( view ) * sign( phaseG );
				anisotropic = textureCubeUV( envMap, scatter, skyRoughness ).rgb;
			}
		}
	#endif
	vec3 sky = mix( isotropic, anisotropic, abs( phaseG ) ) * skyEnergy;
	return mix( ambientColor, sky, skyContribution ) * ambientInject;
}

// The medium at a point of the froxel, as a fraction of its cell.
vec4 froxelMedium( vec3 froxel, vec3 offset ) {
	vec3 light = vec3( 0.0 );
	if ( density > litDensityMin ) {
		vec3 view = froxelView( ( froxel + offset ) / gridSize );
		light = lightsAt( view );
		if ( ambientInject > 0.0 ) light += ambientAt( view );
	}
	return vec4( light * scattering + emission, density );
}

// .glsl:315-324: a view-space point as a unit position in the last frame's volume.
vec3 previousUnit( vec3 view ) {
	vec3 previous = ( toPreviousView * vec4( view, 1.0 ) ).xyz;
	float depth = previous.z / - fogLength;
	vec2 cell = previous.xy / mix( frustumBegin, frustumEnd, vec2( depth ) ) * 0.5 + 0.5;
	return vec3( cell, pow( depth, 1.0 / detailSpread ) );
}

void main() {
	vec3 froxel = vec3( floor( gl_FragCoord.xy ), slice );
	if ( historyAmount > 0.0 ) {
		vec3 unit = previousUnit( froxelView( ( froxel + 0.5 ) / gridSize ) );
		bool reprojects = all( greaterThan( unit, vec3( 0.0 ) ) ) && all( lessThan( unit, vec3( 1.0 ) ) );
		// A cell that cannot reproject keeps its centre and no history.
		vec4 medium = froxelMedium( froxel, reprojects ? sampleOffsets[ 0 ] : vec3( 0.5 ) );
		gl_FragColor = reprojects ? mix( medium, texture( history, unit ), historyAmount ) : medium;
		return;
	}
	vec4 medium = vec4( 0.0 );
	for ( int i = 0; i < sampleCount; i ++ ) medium += froxelMedium( froxel, sampleOffsets[ i ] );
	gl_FragColor = medium / float( sampleCount );
}
`;

/** One 7-tap gaussian along `axis`, clamped to the volume's edge (`.glsl:731-746`). */
export const FOG_FILTER_FRAGMENT = /* glsl */ `
uniform highp sampler3D source;
uniform float slice;
uniform ivec3 axis;
uniform float weights[ 7 ];

void main() {
	ivec3 froxel = ivec3( ivec2( gl_FragCoord.xy ), int( slice ) );
	ivec3 last = textureSize( source, 0 ) - 1;
	vec4 sum = vec4( 0.0 );
	for ( int i = - 3; i <= 3; i ++ ) {
		sum += texelFetch( source, clamp( froxel + axis * i, ivec3( 0 ), last ), 0 ) * weights[ i + 3 ];
	}
	gl_FragColor = sum;
}
`;

/**
 * The fog in front of each froxel: the column integrated front to back under Beer's law
 * (`.glsl:697-727`). `FOG_DEPTH` is the slice count, and each slice's depth comes from the CPU.
 */
export const FOG_INTEGRATE_FRAGMENT = /* glsl */ `
uniform highp sampler3D source;
uniform float slice;
uniform float sliceDepths[ FOG_DEPTH ];

void main() {
	ivec2 column = ivec2( gl_FragCoord.xy );
	int last = int( slice );
	vec4 accumulated = vec4( 0.0, 0.0, 0.0, 1.0 );
	float previousDepth = 0.0;
	for ( int i = 0; i < FOG_DEPTH; i ++ ) {
		if ( i > last ) break;
		vec4 fog = texelFetch( source, ivec3( column, i ), 0 );
		float depth = sliceDepths[ i ];
		float transmittance = exp( - abs( previousDepth - depth ) * fog.a );
		accumulated.rgb += ( ( fog.rgb - fog.rgb * transmittance ) / max( fog.a, 0.00001 ) ) * accumulated.a;
		accumulated.a *= transmittance;
		previousDepth = depth;
	}
	gl_FragColor = accumulated;
}
`;

/** One slice of `source`, as it is: the history's copy of the medium (`environment/fog.cpp:1163-1169`). */
export const FOG_COPY_FRAGMENT = /* glsl */ `
uniform highp sampler3D source;
uniform float slice;

void main() {
	gl_FragColor = texelFetch( source, ivec3( ivec2( gl_FragCoord.xy ), int( slice ) ), 0 );
}
`;
