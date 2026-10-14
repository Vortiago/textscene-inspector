/**
 * The fragment shaders of the fog volume's three passes, as Godot 4.6.3's compute passes run them
 * (`renderer_rd/shaders/environment/volumetric_fog_process.glsl`, cited as `.glsl:N`). Each draw
 * fills one slice of a 3D target, one fragment per froxel, so `gl_FragCoord.xy` is the froxel's
 * column. The volume's rows run bottom-up, as WebGL's fragments do, where Godot's run top-down.
 */

import {
  VOLUMETRIC_FOG_SHADOW_FADE,
  VOLUMETRIC_FOG_SHADOW_OPACITY_MIN,
  VOLUMETRIC_FOG_TEMPORAL_JITTERS,
} from '../../godot/volumetricFog.js';
import { glslFloat } from '../../resources/environment/glslLiterals.js';
import { HENYEY_GREENSTEIN_GLSL } from '../henyeyGreenstein.js';
import { FogLightKind, FogLightTexel } from './fogLights.js';
import { LTC_INTEGRAL } from '../areaLight/ltcIntegral.js';

/** The offsets a still froxel samples and averages: Godot's 16 jitters, or its centre alone. */
export const FOG_SAMPLE_OFFSETS_MAX = VOLUMETRIC_FOG_TEMPORAL_JITTERS.length;

/**
 * Lights one froxel: each light's scatter (`.glsl:252-255`, an area light's from 4.7.2), under its
 * shadow (`.glsl:388-422,488-510,552-574`, 4.7.2 `:671-691`), and the ambient with its sky
 * (`.glsl:430-445`), times the albedo, plus the emission (`.glsl:681`). A moving camera's froxel
 * blends this frame's jitter into its reprojected history (`.glsl:311-335,683`). A still one
 * averages its sample offsets, the mean the history converges to. A clear cell scatters nothing
 * (`.glsl:383`).
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
uniform highp sampler2D directionalShadowAtlas;
uniform highp sampler2D positionalShadowAtlas;
uniform vec3 sampleOffsets[${FOG_SAMPLE_OFFSETS_MAX}];
uniform int sampleCount;
uniform highp sampler3D history;
uniform mat4 toPreviousView;
uniform float historyAmount;

#ifdef ENVMAP_TYPE_CUBE_UV
	uniform sampler2D envMap;
#endif

${HENYEY_GREENSTEIN_GLSL}
${LTC_INTEGRAL}
// The falloff of omni and spot lights alike (.glsl:228-235).
float omniAttenuation( float range, float inverseRange, float decay ) {
	float nd = range * inverseRange;
	nd *= nd;
	nd *= nd;
	nd = max( 1.0 - nd, 0.0 );
	nd *= nd;
	return nd * pow( max( range, 0.0001 ), - decay );
}

// .glsl:418, :509 and :573: the fog past a caster darkens over a tenth of a unit (INV_FOG_FADE,
// .glsl:278). Depths run from the light, so a cell past the caster is the deeper.
float fogShadow( float cellDepth, float casterDepth, float depthRange ) {
	return exp( min( 0.0, casterDepth - cellDepth ) * depthRange * ${glslFloat(VOLUMETRIC_FOG_SHADOW_FADE)} );
}

// .glsl:420: a directional shadow lifts across the far end of its last split. Ends that do not
// ascend are a split sun no fit has faded, and keep smoothstep defined.
float fogShadowFade( float shadow, float viewDepth, float fadeFrom, float fadeTo ) {
	return fadeTo > fadeFrom ? mix( shadow, 1.0, smoothstep( fadeFrom, fadeTo, viewDepth ) ) : shadow;
}

// .glsl:422, :509 and :573
float fogShadowAttenuation( float shadow, float opacity ) {
	return mix( 1.0 - opacity, 1.0, shadow );
}

// .glsl:304-309: the unit depth packs towards the camera before it spreads to the frustum.
vec3 froxelView( vec3 unit ) {
	float depth = pow( unit.z, detailSpread );
	vec2 halfExtents = mix( frustumBegin, frustumEnd, vec2( depth ) );
	return vec3( ( unit.xy * 2.0 - 1.0 ) * halfExtents, - fogLength * depth );
}

// 4.7.2 volumetric_fog_process.glsl:620-695, without the shadow, which lightsAt applies, and the
// area texture. Godot keeps the distance at 1 or more against flicker at froxels the light passes
// through (:642-649).
vec3 areaLightScatter( vec3 view, vec3 eye, vec4 position, vec4 color, vec4 facing, vec3 width, vec3 height ) {
	if ( dot( width, width ) <= 1e-4 || dot( height, height ) <= 1e-4 ) return vec3( 0.0 );
	float widthLength = length( width );
	float heightLength = length( height );
	vec3 widthAxis = width / widthLength;
	vec3 heightAxis = height / heightLength;
	vec3 lightToView = view - position.xyz;
	float inFront = smoothstep( 0.0, 0.1, dot( facing.xyz, lightToView ) );
	if ( inFront <= 0.0 ) return vec3( 0.0 );
	vec2 local = vec2( dot( lightToView, widthAxis ), dot( lightToView, heightAxis ) );
	vec2 halfSize = vec2( widthLength, heightLength ) / 2.0;
	vec2 closest = clamp( local, - halfSize, halfSize );
	vec3 toLight = position.xyz + closest.x * widthAxis + closest.y * heightAxis - view;
	float toLightLength = length( toLight );
	vec3 lightDirection = toLightLength < 1e-4 ? facing.xyz : toLight / toLightLength;
	float lightDistance = max( toLightLength, 1.0 );
	if ( lightDistance * facing.w >= 1.0 ) return vec3( 0.0 );
	float attenuation = omniAttenuation( lightDistance, position.w, color.w );
	vec3 halfWidth = width / 2.0;
	vec3 halfHeight = height / 2.0;
	vec3 points[ 4 ];
	points[ 0 ] = position.xyz - halfWidth - halfHeight - view;
	points[ 1 ] = position.xyz + halfWidth - halfHeight - view;
	points[ 2 ] = position.xyz + halfWidth + halfHeight - view;
	points[ 3 ] = position.xyz - halfWidth + halfHeight - view;
	// ltc_evaluate_diff builds its basis from a fixed axis, not the view (area_lights_inc.glsl:348).
	vec3 basisAxis = abs( lightDirection.z ) < 0.7 ? vec3( 0.0, 0.0, - 1.0 ) : vec3( 1.0, 0.0, 0.0 );
	float diffuse = godotLtcIntegral( lightDirection, basisAxis, mat3( 1.0 ), points ) * ( 2.0 * PI );
	float cosTheta = toLightLength > 1e-2 ? dot( lightDirection, eye ) : 0.0;
	return color.rgb * attenuation * diffuse * inFront * henyey_greenstein( cosTheta, phaseG );
}

// Godot reads an atlas's depth through a linear sampler that clamps at the edge (.glsl:417, :507,
// :571). The pass reads the atlas uncompared and unfiltered, so it filters the four nearest texels.
float atlasDepth( highp sampler2D atlas, vec2 uv ) {
	ivec2 last = textureSize( atlas, 0 ) - 1;
	vec2 texel = uv * vec2( last + 1 ) - 0.5;
	ivec2 base = ivec2( floor( texel ) );
	vec2 weight = texel - floor( texel );
	float d00 = texelFetch( atlas, clamp( base, ivec2( 0 ), last ), 0 ).r;
	float d10 = texelFetch( atlas, clamp( base + ivec2( 1, 0 ), ivec2( 0 ), last ), 0 ).r;
	float d01 = texelFetch( atlas, clamp( base + ivec2( 0, 1 ), ivec2( 0 ), last ), 0 ).r;
	float d11 = texelFetch( atlas, clamp( base + ivec2( 1, 1 ), ivec2( 0 ), last ), 0 ).r;
	return mix( mix( d00, d10, weight.x ), mix( d01, d11, weight.x ), weight.y );
}

vec4 lightTexel( int light, int texel ) {
	return texelFetch( fogLights, ivec2( texel, light ), 0 );
}

mat4 shadowLookup( int light, int slot ) {
	int first = ${FogLightTexel.SHADOW_MATRICES} + slot * 4;
	return mat4( lightTexel( light, first ), lightTexel( light, first + 1 ), lightTexel( light, first + 2 ), lightTexel( light, first + 3 ) );
}

// .glsl:388-422: the split the cell's depth falls in, its depth range and the light's fade.
float directionalShadow( int light, vec3 view ) {
	float depth = - view.z;
	vec4 splits = lightTexel( light, ${FogLightTexel.SHADOW_SPLITS} );
	int slot = depth < splits.x ? 0 : depth < splits.y ? 1 : depth < splits.z ? 2 : 3;
	vec4 coord = shadowLookup( light, slot ) * vec4( view, 1.0 );
	coord.xyz /= coord.w;
	float range = lightTexel( light, ${FogLightTexel.SHADOW_RANGES} )[ slot ];
	float shadow = fogShadow( coord.z, atlasDepth( directionalShadowAtlas, coord.xy ), range );
	vec4 fade = lightTexel( light, ${FogLightTexel.SHADOW_FADE} );
	return fogShadowFade( shadow, depth, fade.x, fade.y );
}

// .glsl:488-510 and 4.7.2 :674-690: a cell at local in the light's space, read from the
// paraboloid in uvRect. The depth runs from the light over depthRange.
float paraboloidShadow( vec3 local, vec4 uvRect, float bias, float depthRange ) {
	vec3 direction = normalize( local );
	direction.z = 1.0 + abs( direction.z );
	vec2 uv = uvRect.xy + ( direction.xy / direction.z * 0.5 + 0.5 ) * uvRect.zw;
	float cellDepth = ( length( local ) - bias ) / depthRange;
	return fogShadow( cellDepth, atlasDepth( positionalShadowAtlas, uv ), depthRange );
}

// .glsl:488-510: the paraboloid the cell faces, in its slot. The depth runs from the light to its range.
float omniShadow( int light, vec3 view, float bias, float depthRange ) {
	vec3 local = ( shadowLookup( light, 0 ) * vec4( view, 1.0 ) ).xyz;
	vec4 slot = lightTexel( light, ${FogLightTexel.SHADOW_SPLITS} );
	vec2 flipOffset = slot.zw;
	vec4 uvRect = vec4( slot.xy, vec2( max( flipOffset.x, flipOffset.y ) ) );
	if ( local.z >= 0.0 ) uvRect.xy += flipOffset;
	return paraboloidShadow( local, uvRect, bias, depthRange );
}

// .glsl:566: Godot's fog subtracts the bias from its reversed depth before the divide. three's depth
// runs forward, so the bias adds and the cell moves away from the light. A surface's bias pulls it
// towards the light instead (scene_forward_lights_inc.glsl:786).
float spotCellDepth( float clipDepth, float bias ) {
	return clipDepth + bias;
}

// .glsl:552-574
float spotShadow( int light, vec3 view, float bias, float depthRange ) {
	vec4 coord = shadowLookup( light, 0 ) * vec4( view, 1.0 );
	coord.z = spotCellDepth( coord.z, bias );
	coord.xyz /= coord.w;
	return fogShadow( coord.z, atlasDepth( positionalShadowAtlas, coord.xy ), depthRange );
}

// 4.7.2 .glsl:671-691: the light's one paraboloid in its slot. The depth runs from the light over
// its centre range.
float areaShadow( int light, vec3 view, float bias, float depthRange ) {
	vec3 local = ( shadowLookup( light, 0 ) * vec4( view, 1.0 ) ).xyz;
	return paraboloidShadow( local, lightTexel( light, ${FogLightTexel.SHADOW_SPLITS} ), bias, depthRange );
}

// .glsl:425, :511 and :550-575
vec3 lightsAt( vec3 view ) {
	vec3 eye = normalize( view );
	vec3 total = vec3( 0.0 );
	for ( int i = 0; i < lightCount; i ++ ) {
		vec4 position = lightTexel( i, ${FogLightTexel.POSITION} );
		vec4 color = lightTexel( i, ${FogLightTexel.COLOR} );
		vec4 direction = lightTexel( i, ${FogLightTexel.DIRECTION} );
		vec4 cone = lightTexel( i, ${FogLightTexel.CONE} );
		int kind = int( cone.y );
		bool isShadowed = cone.z > ${glslFloat(VOLUMETRIC_FOG_SHADOW_OPACITY_MIN)};
		if ( kind == ${FogLightKind.DIRECTIONAL} ) {
			float shadow = isShadowed ? fogShadowAttenuation( directionalShadow( i, view ), cone.z ) : 1.0;
			total += color.rgb * shadow * henyey_greenstein( dot( eye, direction.xyz ), phaseG );
			continue;
		}
		if ( kind == ${FogLightKind.AREA} ) {
			vec3 width = lightTexel( i, ${FogLightTexel.AREA_WIDTH} ).xyz;
			vec3 height = lightTexel( i, ${FogLightTexel.AREA_HEIGHT} ).xyz;
			vec3 scatter = areaLightScatter( view, eye, position, color, direction, width, height );
			// The row's direction carries one over the centre range (fogLights.ts).
			if ( isShadowed && scatter != vec3( 0.0 ) ) {
				scatter *= fogShadowAttenuation( areaShadow( i, view, cone.w, 1.0 / direction.w ), cone.z );
			}
			total += scatter;
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
		if ( isShadowed ) {
			float depthRange = 1.0 / position.w;
			float shadow = kind == ${FogLightKind.SPOT} ? spotShadow( i, view, cone.w, depthRange ) : omniShadow( i, view, cone.w, depthRange );
			attenuation *= fogShadowAttenuation( shadow, cone.z );
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
