/**
 * Godot's omni and spot shadow lookups (`scene_forward_lights_inc.glsl:474-597`, `:776-847`) in GLSL
 * for three's chunks: the receiver offsets, and the PCF that samples the one positional shadow atlas.
 * `positionalShadowChunk.ts` puts each where three's own lookup stood.
 */

import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/softShadowKernel.js';
import { FRAMEBUFFER_HEIGHT_UNIFORM } from './framebufferRows.js';
import { POSITIONAL_SHADOW_ATLAS_UNIFORM } from './shadowAtlasTarget.js';

const ATLAS = POSITIONAL_SHADOW_ATLAS_UNIFORM;

/** A float literal GLSL reads back as the same float32. */
function glslFloat(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

const KERNEL = vogelDisk(SOFT_LOW_SHADOW_SAMPLES)
  .map(([x, y]) => `vec2( ${glslFloat(x)}, ${glslFloat(y)} )`)
  .join(', ');

/**
 * The atlas, the kernel and its turn, shared by both lookups. The turn is `quick_hash` of the
 * fragment's position (`:278-281`, `:343-350`), with no TAA frame to offset it, and with its rows
 * counted from the top, as Godot's are (`framebufferRows.ts`).
 */
export const ATLAS_SAMPLING = `
		uniform sampler2DShadow ${ATLAS};
		uniform float ${FRAMEBUFFER_HEIGHT_UNIFORM}[ 1 ];
		const vec2 GODOT_SOFT_SHADOW_KERNEL[ ${SOFT_LOW_SHADOW_SAMPLES} ] = vec2[]( ${KERNEL} );
		mat2 godotDiskRotation() {
			vec2 fragCoord = vec2( gl_FragCoord.x, ${FRAMEBUFFER_HEIGHT_UNIFORM}[ 0 ] - gl_FragCoord.y );
			float r = fract( 52.9829189 * fract( dot( fragCoord, vec2( 0.06711056, 0.00583715 ) ) ) ) * PI2;
			float sr = sin( r );
			float cr = cos( r );
			return mat2( vec2( cr, - sr ), vec2( sr, cr ) );
		}
		vec2 godotAtlasTexel() {
			return 1.0 / vec2( textureSize( ${ATLAS}, 0 ) );
		}
`;

/**
 * The spot lookup. The receiver moves along the normal by the normal bias times its distance to the
 * light (`:780-783`). three's depth is one minus Godot's reversed depth, so Godot's bias is subtracted
 * (`:786-787`). `sample_pcf_shadow` (`:310-335`) spans `soft_shadow_scale` atlas texels (`:847`).
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
		float godotSpotShadow( vec4 shadowCoord, float softShadowScale, float shadowIntensity ) {
			vec3 coord = shadowCoord.xyz / shadowCoord.w;
			vec2 pixelSize = softShadowScale * godotAtlasTexel();
			mat2 rotation = godotDiskRotation();
			float shadow = 0.0;
			for ( int i = 0; i < ${SOFT_LOW_SHADOW_SAMPLES}; i ++ ) {
				vec2 tap = coord.xy + pixelSize * ( rotation * GODOT_SOFT_SHADOW_KERNEL[ i ] );
				shadow += texture( ${ATLAS}, vec3( tap, coord.z ) );
			}
			return mix( 1.0, shadow / ${glslFloat(SOFT_LOW_SHADOW_SAMPLES)}, shadowIntensity );
		}
`;

/**
 * The omni lookup (`:474-489`, `:586-597`) and `sample_omni_pcf_shadow` (`:337-379`). Light space is
 * the upper rows of `pointShadowMatrix`, and its bottom row holds the slot (`atlasOmniShadow.ts`).
 * The paraboloid lies inset one texel inside its slot (`:476-478`), and a tap that leaves the unit
 * disc reads the other paraboloid. The depth runs from the light to its range, as the copy wrote it.
 */
export const OMNI_LOOKUP = `
		vec3 godotOmniLocalNormal( mat4 shadowMatrix, vec3 viewNormal ) {
			return normalize( mat3( shadowMatrix ) * transformNormalByInverseViewMatrix( viewNormal, viewMatrix ) );
		}
		float godotOmniPcf( float blurScale, vec2 coord, vec4 uvRect, vec2 flipOffset, float depth ) {
			mat2 rotation = godotDiskRotation();
			vec2 offsetScale = blurScale * 2.0 * godotAtlasTexel() / uvRect.zw;
			float shadow = 0.0;
			for ( int i = 0; i < ${SOFT_LOW_SHADOW_SAMPLES}; i ++ ) {
				vec2 tap = coord + offsetScale * ( rotation * GODOT_SOFT_SHADOW_KERNEL[ i ] );
				float lengthSquared = dot( tap, tap );
				bool doFlip = lengthSquared > 1.0;
				if ( doFlip ) tap *= 2.0 / sqrt( lengthSquared ) - 1.0;
				tap = uvRect.xy + ( tap * 0.5 + 0.5 ) * uvRect.zw;
				if ( doFlip ) tap += flipOffset;
				shadow += texture( ${ATLAS}, vec3( tap, depth ) );
			}
			return shadow / ${glslFloat(SOFT_LOW_SHADOW_SAMPLES)};
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
			vec3 shadowSample = normalize( shadowDir + normalBias );
			if ( shadowSample.z >= 0.0 ) {
				uvRect.xy += flipOffset;
				flipOffset *= - 1.0;
			}
			shadowSample.z = 1.0 + abs( shadowSample.z );
			vec2 coord = shadowSample.xy / shadowSample.z;
			float depth = ( shadowLength - pointShadow.shadowBias ) / pointShadow.shadowCameraFar;
			float shadow = godotOmniPcf( pointShadow.shadowRadius / shadowSample.z, coord, uvRect, flipOffset, depth );
			return mix( 1.0, shadow, pointShadow.shadowIntensity );
		}
`;
