/**
 * Godot's omni, spot and area shadow lookups (`scene_forward_lights_inc.glsl:474-597`, `:776-847`,
 * 4.7.2 `:1008-1110`) in GLSL for three's chunks: the receiver offsets, and the filters that sample
 * the one positional shadow atlas. `positionalShadowChunk.ts` puts each where three's chunks need it.
 * A shadow's `shadowRadius` is its PCF kernel's radius, or minus its penumbra's spread for a light
 * that searches for blockers (`softShadowRadius.ts`).
 */

import {
  AREA_LIGHT_SHADOW_MATRICES,
  AREA_LIGHT_SHADOW_RECTS,
  AREA_LIGHT_SHADOWS,
  AREA_LIGHT_SOFT_SHADOW_RADII,
} from '../areaLight/areaLightShadowUniforms.js';
import {
  POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM,
  POSITIONAL_SHADOW_ATLAS_UNIFORM,
} from './shadowAtlasTarget.js';
import { LIGHT_SOFT_SHADOWS } from '../shadowFilter/softShadowSearch.js';
import { PARABOLOID_UV_GLSL } from './paraboloidUv.js';

const ATLAS = POSITIONAL_SHADOW_ATLAS_UNIFORM;
const ATLAS_COLOUR = POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM;

/**
 * The atlas, its texel and `sample_omni_pcf_shadow` (`:337-379`), shared by every lookup. Each calls
 * Godot's soft shadow filter, which `installSoftShadowFilter` puts ahead of every shadow block
 * (`../shadowFilter/softShadowFilter.ts`). A tap that leaves the unit disc reads the other
 * paraboloid, `flipOffset` away, and an area light's one paraboloid passes no offset.
 *
 * The blocker search of an omni or area light reads the depth uncompared from the atlas's colour
 * (`godotRawDepth`, `:498-551`). The depth runs from the light to the far plane, so a blocker is a
 * smaller depth, where Godot's reversed depth is a larger one. Every search compiles only under
 * Godot's light soft shadows (`../shadowFilter/softShadowSearch.ts`).
 */
export const ATLAS_SAMPLING = `
		uniform sampler2DShadow ${ATLAS};
		#ifdef ${LIGHT_SOFT_SHADOWS}
		uniform sampler2D ${ATLAS_COLOUR};
		#endif
		vec2 godotAtlasTexel() {
			return 1.0 / vec2( textureSize( ${ATLAS}, 0 ) );
		}
		float godotOmniPcf( float blurScale, vec2 coord, vec4 uvRect, vec2 flipOffset, float depth ) {
			mat2 rotation = godotDiskRotation();
			vec2 offsetScale = blurScale * 2.0 * godotAtlasTexel() / uvRect.zw;
			float shadow = 0.0;
			for ( int i = 0; i < GODOT_SOFT_SHADOW_SAMPLES; i ++ ) {
				vec2 tap = coord + offsetScale * ( rotation * GODOT_SOFT_SHADOW_KERNEL[ i ] );
				float lengthSquared = dot( tap, tap );
				bool doFlip = lengthSquared > 1.0;
				if ( doFlip ) tap *= 2.0 / sqrt( lengthSquared ) - 1.0;
				tap = uvRect.xy + ( tap * 0.5 + 0.5 ) * uvRect.zw;
				if ( doFlip ) tap += flipOffset;
				shadow += texture( ${ATLAS}, vec3( tap, depth ) );
			}
			return shadow * ( 1.0 / float( GODOT_SOFT_SHADOW_SAMPLES ) );
		}
		#ifdef ${LIGHT_SOFT_SHADOWS}
		${PARABOLOID_UV_GLSL}
		float godotParaboloidSoftShadow( vec3 localVert, vec3 normalBias, vec4 uvRect, vec2 flipOffset, float depth, float referenceOffset, float spread ) {
			mat2 rotation = godotDiskRotation();
			vec3 shadowDir = normalize( localVert );
			vec3 v0 = abs( shadowDir.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 0.0, 1.0, 0.0 );
			vec3 tangent = normalize( cross( v0, shadowDir ) );
			vec3 bitangent = normalize( cross( tangent, shadowDir ) );
			tangent *= spread;
			bitangent *= spread;
			float blockerSum = 0.0;
			float blockerCount = 0.0;
			for ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
				vec2 disk = rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ];
				vec3 tap = normalize( localVert + tangent * disk.x + bitangent * disk.y );
				float blocker = godotRawDepth( ${ATLAS_COLOUR}, godotParaboloidUv( tap, uvRect, flipOffset ) );
				if ( blocker < depth ) {
					blockerSum += blocker;
					blockerCount += 1.0;
				}
			}
			if ( blockerCount == 0.0 ) return 1.0;
			float blockerAverage = blockerSum / blockerCount;
			float penumbra = ( depth - blockerAverage ) / blockerAverage;
			tangent *= penumbra;
			bitangent *= penumbra;
			float reference = depth - referenceOffset;
			float shadow = 0.0;
			for ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
				vec2 disk = rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ];
				vec3 tap = normalize( normalize( localVert + tangent * disk.x + bitangent * disk.y ) + normalBias );
				shadow += texture( ${ATLAS}, vec3( godotParaboloidUv( tap, uvRect, flipOffset ), reference ) );
			}
			return shadow / float( GODOT_PENUMBRA_SHADOW_SAMPLES );
		}
		#endif
`;

/**
 * The spot lookup. The receiver moves along the normal by the normal bias times its distance to the
 * light (`:780-783`). three's depth is one minus Godot's reversed depth, so Godot's bias is subtracted
 * (`:786-787`). `sample_pcf_shadow` (`:310-335`) spans `soft_shadow_scale` atlas texels (`:847`).
 *
 * A light with a penumbra searches its slot for blockers (`:789-837`). Its penumbra size is half the
 * light's size over its range, over the cone's slope, in units of the atlas (`light_storage.cpp:1019`).
 * `lightDepth` is the receiver's depth along the light's axis, the w of its unbiased coordinate. The
 * slot is centred on the light's axis, which the matrix maps to the axis's vanishing point.
 */
export const SPOT_LOOKUP = `
		vec4 godotSpotDepthBias( vec4 shadowCoord, float depthBias ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z += depthBias;
			#else
				shadowCoord.z -= depthBias;
			#endif
			return shadowCoord;
		}
		vec4 godotSpotShadowCoord( vec4 shadowCoord, mat4 lightMatrix, vec3 viewToLight, vec3 viewNormal, float normalBias, float depthBias ) {
			float lightLength = length( viewToLight );
			float slope = 1.0 - abs( dot( viewNormal, viewToLight / lightLength ) );
			vec3 worldNormal = transformNormalByInverseViewMatrix( viewNormal, viewMatrix );
			vec4 coord = shadowCoord + lightMatrix * vec4( worldNormal * lightLength * normalBias * slope, 0.0 );
			return godotSpotDepthBias( coord, depthBias );
		}
		#ifdef ${LIGHT_SOFT_SHADOWS}
		vec4 godotSpotSlotRect( mat4 lightMatrix, vec3 viewDirection, vec2 slotTexels ) {
			vec4 axis = lightMatrix * vec4( - viewDirection * mat3( viewMatrix ), 0.0 );
			vec2 size = slotTexels * godotAtlasTexel();
			return vec4( axis.xy / axis.w - size * 0.5, size );
		}
		float godotSpotSoftShadow( vec3 coord, float lightDepth, SpotLight light, mat4 lightMatrix, SpotLightShadow shadow ) {
			if ( light.distance <= 0.0 ) return 1.0;
			vec4 slotRect = godotSpotSlotRect( lightMatrix, light.direction, shadow.shadowMapSize );
			float coneSlope = sqrt( 1.0 - light.coneCos * light.coneCos ) / light.coneCos;
			float zNorm = lightDepth / light.distance;
			float uvSize = - shadow.shadowRadius * 0.5 / light.distance / coneSlope * slotRect.z * zNorm;
			mat2 rotation = godotDiskRotation();
			float blockerSum = 0.0;
			float blockerCount = 0.0;
			for ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
				vec2 offset = ( rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ] ) * uvSize;
				float blocker = godotRawDepth( ${ATLAS_COLOUR}, clamp( coord.xy + offset, slotRect.xy, slotRect.xy + slotRect.zw ) );
				if ( blocker < coord.z ) {
					blockerSum += blocker;
					blockerCount += 1.0;
				}
			}
			if ( blockerCount == 0.0 ) return 1.0;
			float blockerAverage = blockerSum / blockerCount;
			uvSize *= ( 1.0 - blockerAverage - zNorm ) / blockerAverage;
			float lit = 0.0;
			for ( int i = 0; i < GODOT_PENUMBRA_SHADOW_SAMPLES; i ++ ) {
				vec2 offset = ( rotation * GODOT_PENUMBRA_SHADOW_KERNEL[ i ] ) * uvSize;
				lit += texture( ${ATLAS}, vec3( clamp( coord.xy + offset, slotRect.xy, slotRect.xy + slotRect.zw ), coord.z ) );
			}
			return lit / float( GODOT_PENUMBRA_SHADOW_SAMPLES );
		}
		#endif
		float godotSpotShadow( vec4 shadowCoord, float lightDepth, SpotLight light, mat4 lightMatrix, SpotLightShadow shadow ) {
			vec3 coord = shadowCoord.xyz / shadowCoord.w;
			float lit;
			#ifdef ${LIGHT_SOFT_SHADOWS}
			if ( shadow.shadowRadius < 0.0 ) {
				lit = godotSpotSoftShadow( coord, lightDepth, light, lightMatrix, shadow );
			} else
			#endif
			{
				lit = godotPcf( ${ATLAS}, shadow.shadowRadius * godotAtlasTexel(), coord );
			}
			return mix( 1.0, lit, shadow.shadowIntensity );
		}
`;

/**
 * The omni lookup (`:474-489`, `:586-597`). Light space is the upper rows of `pointShadowMatrix`, and
 * its bottom row holds the slot (`atlasOmniShadow.ts`). The paraboloid lies inset one texel inside
 * its slot (`:476-478`). The depth runs from the light to its range, as the copy wrote it. A light
 * with a penumbra searches both paraboloids for blockers (`:491-570`).
 */
export const OMNI_LOOKUP = `
		vec3 godotOmniLocalNormal( mat4 shadowMatrix, vec3 viewNormal ) {
			return normalize( mat3( shadowMatrix ) * transformNormalByInverseViewMatrix( viewNormal, viewMatrix ) );
		}
		float godotOmniShadow( mat4 shadowMatrix, vec3 localVert, vec3 localNormal, PointLightShadow pointShadow ) {
			vec2 texel = godotAtlasTexel();
			vec4 slot = vec4( shadowMatrix[ 0 ][ 3 ], shadowMatrix[ 1 ][ 3 ], shadowMatrix[ 2 ][ 3 ], shadowMatrix[ 3 ][ 3 ] );
			vec2 flipOffset = slot.zw;
			float slotSize = max( flipOffset.x, flipOffset.y );
			vec4 uvRect = vec4( slot.xy + texel, vec2( slotSize ) - texel * 2.0 );
			float shadowLength = length( localVert );
			vec3 shadowDir = normalize( localVert );
			vec3 normalBias = localNormal * pointShadow.shadowNormalBias * ( 1.0 - abs( dot( localNormal, shadowDir ) ) );
			float depth = shadowLength / pointShadow.shadowCameraFar;
			float referenceOffset = pointShadow.shadowBias / pointShadow.shadowCameraFar;
			float shadow;
			#ifdef ${LIGHT_SOFT_SHADOWS}
			if ( pointShadow.shadowRadius < 0.0 ) {
				shadow = godotParaboloidSoftShadow( localVert, normalBias, uvRect, flipOffset, depth, referenceOffset, - pointShadow.shadowRadius );
			} else
			#endif
			{
				vec3 shadowSample = normalize( shadowDir + normalBias );
				if ( shadowSample.z >= 0.0 ) {
					uvRect.xy += flipOffset;
					flipOffset *= - 1.0;
				}
				shadowSample.z = 1.0 + abs( shadowSample.z );
				vec2 coord = shadowSample.xy / shadowSample.z;
				shadow = godotOmniPcf( pointShadow.shadowRadius / shadowSample.z, coord, uvRect, flipOffset, depth - referenceOffset );
			}
			return mix( 1.0, shadow, pointShadow.shadowIntensity );
		}
`;

/**
 * The area lookup, `light_process_area`'s shadow (4.7.2 `scene_forward_lights_inc.glsl:1008-1110`),
 * for the light at `index` of the arrays `areaLightShadowUniforms.ts` writes. Its terms are the
 * opacity, the normal bias, the bias and the depth scale. Its one paraboloid lies inset one texel in
 * its slot, and a receiver behind the light reads the paraboloid's mirror, as Godot's `abs` does.
 * Every area light pairs its receivers with soft shadows (4.7.2 `renderer_scene_cull.cpp:1795`), so
 * a light with a penumbra searches for blockers.
 */
export const AREA_LOOKUP = `
		uniform highp mat4 ${AREA_LIGHT_SHADOW_MATRICES}[ NUM_RECT_AREA_LIGHTS ];
		uniform vec4 ${AREA_LIGHT_SHADOW_RECTS}[ NUM_RECT_AREA_LIGHTS ];
		uniform vec4 ${AREA_LIGHT_SHADOWS}[ NUM_RECT_AREA_LIGHTS ];
		uniform float ${AREA_LIGHT_SOFT_SHADOW_RADII}[ NUM_RECT_AREA_LIGHTS ];
		float godotAreaShadow( const in int index, const in vec3 geometryPosition, const in vec3 viewNormal ) {
			vec4 terms = ${AREA_LIGHT_SHADOWS}[ index ];
			if ( terms.x <= 0.001 ) return 1.0;
			mat4 shadowMatrix = ${AREA_LIGHT_SHADOW_MATRICES}[ index ];
			vec2 texel = godotAtlasTexel();
			vec4 uvRect = ${AREA_LIGHT_SHADOW_RECTS}[ index ];
			uvRect.xy += texel;
			uvRect.zw -= texel * 2.0;
			vec3 localVert = ( shadowMatrix * vec4( geometryPosition, 1.0 ) ).xyz;
			float shadowLength = length( localVert );
			vec3 shadowDir = normalize( localVert );
			vec3 localNormal = normalize( mat3( shadowMatrix ) * viewNormal );
			vec3 normalBias = localNormal * terms.y * ( 1.0 - abs( dot( localNormal, shadowDir ) ) );
			float radius = ${AREA_LIGHT_SOFT_SHADOW_RADII}[ index ];
			float shadow;
			#ifdef ${LIGHT_SOFT_SHADOWS}
			if ( radius < 0.0 ) {
				shadow = godotParaboloidSoftShadow( localVert, normalBias, uvRect, vec2( 0.0 ), shadowLength * terms.w, terms.z * terms.w, - radius );
			} else
			#endif
			{
				vec3 shadowSample = normalize( shadowDir + normalBias );
				shadowSample.z = 1.0 + abs( shadowSample.z );
				float depth = ( shadowLength - terms.z ) * terms.w;
				shadow = godotOmniPcf( radius / shadowSample.z, shadowSample.xy / shadowSample.z, uvRect, vec2( 0.0 ), depth );
			}
			return mix( 1.0, shadow, terms.x );
		}
`;
