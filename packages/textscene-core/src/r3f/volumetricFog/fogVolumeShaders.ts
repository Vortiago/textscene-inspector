/**
 * The fragment shaders of the fog volume's three passes, as Godot 4.6.3's compute passes run them
 * (`renderer_rd/shaders/environment/volumetric_fog_process.glsl`, cited as `.glsl:N`). Each draw
 * fills one slice of a 3D target, one fragment per froxel, so `gl_FragCoord.xy` is the froxel's
 * column. The volume's rows run bottom-up, as WebGL's fragments do, where Godot's run top-down.
 */

import { FogLightKind } from './fogLights.js';

/** The jitters one froxel samples and averages: 16 under temporal reprojection, else its centre. */
export const FOG_SAMPLE_OFFSETS_MAX = 16;

/**
 * Lights one froxel: each light's Henyey-Greenstein scatter (`.glsl:252-255`), and the ambient
 * with its sky (`.glsl:430-445`), averaged over the froxel's sample offsets. The medium scatters
 * them by its albedo and adds its emission (`.glsl:681`). A clear cell scatters nothing (`.glsl:383`).
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
uniform mat3 viewToWorld;
uniform highp sampler2D fogLights;
uniform int lightCount;
uniform vec3 sampleOffsets[${FOG_SAMPLE_OFFSETS_MAX}];
uniform int sampleCount;

#ifdef ENVMAP_TYPE_CUBE_UV
	uniform sampler2D envMap;
#endif

float henyeyGreenstein( float cosTheta, float g ) {
	return RECIPROCAL_PI * 0.25 * ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * cosTheta, 1.5 );
}

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
			total += color.rgb * henyeyGreenstein( dot( eye, direction.xyz ), phaseG );
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
		total += color.rgb * attenuation * henyeyGreenstein( dot( normalize( toLight ), eye ), phaseG );
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
				vec3 scatter = viewToWorld * normalize( view ) * sign( phaseG );
				anisotropic = textureCubeUV( envMap, scatter, skyRoughness ).rgb;
			}
		}
	#endif
	return mix( ambientColor, mix( isotropic, anisotropic, abs( phaseG ) ), skyContribution ) * ambientInject;
}

void main() {
	vec3 froxel = vec3( floor( gl_FragCoord.xy ), slice );
	vec3 light = vec3( 0.0 );
	if ( density > litDensityMin ) {
		for ( int i = 0; i < sampleCount; i ++ ) {
			vec3 view = froxelView( ( froxel + sampleOffsets[ i ] ) / gridSize );
			light += lightsAt( view );
			if ( ambientInject > 0.0 ) light += ambientAt( view );
		}
		light /= float( sampleCount );
	}
	gl_FragColor = vec4( light * scattering + emission, density );
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
