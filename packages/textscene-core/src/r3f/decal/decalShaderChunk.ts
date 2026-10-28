/**
 * Godot's decals in three's programs (`scene_forward_clustered.glsl:1535-1654`): each fragment of a
 * lit or unlit surface takes the albedo of every decal whose box holds it and whose mask the
 * instance's layers meet. A lit surface takes the decals' normal, ORM and emission maps too. The mix
 * runs per fragment, on the interpolated position, so a surface takes a decal whatever its triangles
 * are. The highest row of each group of 32 mixes first.
 */

import * as THREE from 'three';
import { installChunkEdits, type TextEdit } from '../shaderPatch/chunkPatch.js';
import { FOG_UNIFORMS_MERGE, installMergedUniform } from '../shaderPatch/litUniform.js';
import { EMISSION_EXPOSURE_FACTOR, installEmissionExposure } from '../exposure/emissionExposure.js';
import { installGodotOcclusion, OCCLUSION_MIX } from '../materials/godotAmbientOcclusion.js';
import {
  INSTANCE_LAYERS_CHUNK,
  INSTANCE_LAYERS_UNIFORM,
  installInstanceLayers,
} from '../instanceLayers/instanceLayersChunk.js';
import { DECAL_FIRST_ROW, installSceneRows, SCENE_ROWS_CHUNK } from '../sceneRows/sceneRowsChunk.js';
import { GODOT_TO_SRGB_GLSL } from '../../godot/rendering/srgbTransfer.js';
import { DECAL_TEXEL } from './decalRowLayout.js';
import { DECAL_UNIFORMS, decalAtlasSlot, shownDecals } from './decalSlots.js';

const { atlas, shown } = DECAL_UNIFORMS;

/** The chunk that holds the decal functions, which each program that mixes decals includes. */
const GODOT_DECAL_PARS_CHUNK = 'godot_decal_pars';

/** Defined ahead of the chunk by a program that has a normal, roughness, metallic, emission and occlusion to mix. */
const SHADED_DEFINE = 'GODOT_DECAL_SHADED';

const VIEW_VARYING = 'vGodotDecalView';
const NORMAL_VARYING = 'vGodotDecalNormal';
const VARYING_DECLARATIONS = `varying vec3 ${VIEW_VARYING};\nvarying vec3 ${NORMAL_VARYING};\n`;

/**
 * The decal functions, all in view space, as Godot's rows are. `shown` holds the count, the factor
 * that scales the gradients, as `godotMipmapBiasedGrad` does, and whether the atlas magnifies
 * linearly. A normal of zero length stays zero, as `normalize` of it is NaN, which a mix would carry
 * into the albedo. The occlusion is the affine form `ao * x + y`, which composes every ORM mix
 * without the `ao` it starts from. Normal and ORM read the bytes of the atlas's linear view through
 * its sRGB texture (`comparison.md`).
 */
const GODOT_DECAL_GLSL = /* glsl */ `
uniform highp sampler2D ${atlas};
uniform vec4 ${shown}[ 1 ];
#include <${INSTANCE_LAYERS_CHUNK}>
#include <${SCENE_ROWS_CHUNK}>

struct GodotDecalSurface {
	vec3 albedo;
#ifdef ${SHADED_DEFINE}
	vec3 normal;
	float roughness;
	float metallic;
	vec3 emission;
	vec2 occlusion;
#endif
};

/** Where one decal reads its maps for a fragment: the box coordinates and their gradients. */
struct GodotDecalReads {
	vec2 uv;
	vec2 gradientX;
	vec2 gradientY;
};

vec4 godotDecalTexel( int index, int texel ) {
	return godotSceneRowTexel( ${DECAL_FIRST_ROW} + index, texel );
}

bool godotDecalHasMap( vec4 rect ) {
	return rect != vec4( 0.0 );
}

vec4 godotDecalRead( vec4 rect, GodotDecalReads reads ) {
	return textureGrad( ${atlas}, reads.uv * rect.zw + rect.xy, reads.gradientX * rect.zw, reads.gradientY * rect.zw );
}

#ifdef ${SHADED_DEFINE}

${GODOT_TO_SRGB_GLSL}
vec3 godotDecalByteTap( ivec2 tap, ivec2 last ) {
	return godotToSrgb( texelFetch( ${atlas}, clamp( tap, ivec2( 0 ), last ), 0 ).rgb );
}

/**
 * A read that magnifies filters the bytes of the taps itself: the hardware filters their decoded
 * values, which differs between two texels. A read that minifies leaves that to the hardware.
 */
vec3 godotDecalReadBytes( vec4 rect, GodotDecalReads reads ) {
	if ( ${shown}[ 0 ].z == 0.0 ) return godotToSrgb( godotDecalRead( rect, reads ).rgb );
	vec2 atlasSize = vec2( textureSize( ${atlas}, 0 ) );
	vec2 stepX = reads.gradientX * rect.zw * atlasSize;
	vec2 stepY = reads.gradientY * rect.zw * atlasSize;
	if ( max( dot( stepX, stepX ), dot( stepY, stepY ) ) > 1.0 ) return godotToSrgb( godotDecalRead( rect, reads ).rgb );
	vec2 between = ( reads.uv * rect.zw + rect.xy ) * atlasSize - 0.5;
	ivec2 first = ivec2( floor( between ) );
	ivec2 last = ivec2( atlasSize ) - 1;
	vec2 weight = between - floor( between );
	vec3 above = mix( godotDecalByteTap( first, last ), godotDecalByteTap( first + ivec2( 1, 0 ), last ), weight.x );
	vec3 below = mix( godotDecalByteTap( first + ivec2( 0, 1 ), last ), godotDecalByteTap( first + ivec2( 1, 1 ), last ), weight.x );
	return mix( above, below, weight.y );
}

void godotMixDecalNormal( int index, inout GodotDecalSurface surface, float weight, GodotDecalReads reads ) {
	vec4 rect = godotDecalTexel( index, ${DECAL_TEXEL.normalRect} );
	if ( ! godotDecalHasMap( rect ) ) return;
	vec3 decalNormal = godotDecalReadBytes( rect, reads );
	decalNormal.xy = decalNormal.xy * vec2( 2.0, - 2.0 ) - vec2( 1.0, - 1.0 );
	decalNormal.z = sqrt( max( 0.0, 1.0 - dot( decalNormal.xy, decalNormal.xy ) ) );
	mat3 basis = mat3( godotDecalTexel( index, ${DECAL_TEXEL.normalBasis} ).xyz, godotDecalTexel( index, ${DECAL_TEXEL.normalBasis + 1} ).xyz, godotDecalTexel( index, ${DECAL_TEXEL.normalBasis + 2} ).xyz );
	surface.normal = normalize( mix( surface.normal, basis * decalNormal.xzy, weight ) );
}

void godotMixDecalOrm( int index, inout GodotDecalSurface surface, float weight, GodotDecalReads reads ) {
	vec4 rect = godotDecalTexel( index, ${DECAL_TEXEL.ormRect} );
	if ( ! godotDecalHasMap( rect ) ) return;
	vec3 orm = godotDecalReadBytes( rect, reads );
	surface.occlusion = mix( surface.occlusion, vec2( 0.0, orm.r ), weight );
	surface.roughness = mix( surface.roughness, orm.g, weight );
	surface.metallic = mix( surface.metallic, orm.b, weight );
}

void godotAddDecalEmission( int index, inout GodotDecalSurface surface, vec3 modulate, float energy, float fade, GodotDecalReads reads ) {
	vec4 rect = godotDecalTexel( index, ${DECAL_TEXEL.emissionRect} );
	if ( ! godotDecalHasMap( rect ) ) return;
	surface.emission += godotDecalRead( rect, reads ).rgb * modulate * energy * fade;
}

#endif

void godotMixDecal( int index, inout GodotDecalSurface surface, vec3 position, vec3 geometryNormal, vec3 positionDx, vec3 positionDy, float gradientScale ) {
	vec4 toLocalX = godotDecalTexel( index, ${DECAL_TEXEL.toDecal} );
	vec4 toLocalY = godotDecalTexel( index, ${DECAL_TEXEL.toDecal + 1} );
	vec4 toLocalZ = godotDecalTexel( index, ${DECAL_TEXEL.toDecal + 2} );
	vec4 point = vec4( position, 1.0 );
	vec3 local = vec3( dot( toLocalX, point ), dot( toLocalY, point ), dot( toLocalZ, point ) );
	if ( any( lessThan( local, vec3( 0.0, - 1.0, 0.0 ) ) ) || any( greaterThan( local, vec3( 1.0 ) ) ) ) return;
	vec4 maskAndFades = godotDecalTexel( index, ${DECAL_TEXEL.maskAndFades} );
	if ( ( ( uint( maskAndFades.x ) | ( uint( maskAndFades.y ) << 16u ) ) & ${INSTANCE_LAYERS_UNIFORM}[ 0 ] ) == 0u ) return;
	float fade = pow( 1.0 - abs( local.y ), local.y > 0.0 ? maskAndFades.z : maskAndFades.w );
	vec4 upAndFade = godotDecalTexel( index, ${DECAL_TEXEL.up} );
	if ( upAndFade.w > 0.0 ) fade *= smoothstep( upAndFade.w, 1.0, dot( geometryNormal, upAndFade.xyz ) * 0.5 + 0.5 );
	vec2 gradientX = vec2( dot( toLocalX.xyz, positionDx ), dot( toLocalZ.xyz, positionDx ) ) * gradientScale;
	vec2 gradientY = vec2( dot( toLocalX.xyz, positionDy ), dot( toLocalZ.xyz, positionDy ) ) * gradientScale;
	GodotDecalReads reads = GodotDecalReads( local.xz, gradientX, gradientY );
	vec4 modulate = godotDecalTexel( index, ${DECAL_TEXEL.modulate} );
	vec4 energyAndMix = godotDecalTexel( index, ${DECAL_TEXEL.energyAndMix} );
	vec4 albedoRect = godotDecalTexel( index, ${DECAL_TEXEL.albedoRect} );
	if ( godotDecalHasMap( albedoRect ) ) {
		vec4 decalAlbedo = godotDecalRead( albedoRect, reads ) * modulate;
		decalAlbedo.a *= fade;
		surface.albedo = mix( surface.albedo, decalAlbedo.rgb, decalAlbedo.a * energyAndMix.y );
#ifdef ${SHADED_DEFINE}
		godotMixDecalNormal( index, surface, decalAlbedo.a, reads );
		godotMixDecalOrm( index, surface, decalAlbedo.a, reads );
#endif
	}
#ifdef ${SHADED_DEFINE}
	godotAddDecalEmission( index, surface, modulate.rgb, energyAndMix.x, fade, reads );
#endif
}

void godotApplyDecals( inout GodotDecalSurface surface, vec3 position, vec3 normal ) {
	int count = int( ${shown}[ 0 ].x );
	if ( count == 0 ) return;
	float normalLength = length( normal );
	vec3 geometryNormal = normalLength > 0.0 ? normal / normalLength : normal;
	vec3 positionDx = dFdx( position );
	vec3 positionDy = dFdy( position );
	float gradientScale = ${shown}[ 0 ].y;
	for ( int group = 0; group < count; group += 32 ) {
		for ( int index = min( group + 31, count - 1 ); index >= group; index -- ) {
			godotMixDecal( index, surface, position, geometryNormal, positionDx, positionDy, gradientScale );
		}
	}
}
`;

/** Declares the decal functions for a program to include. True: it cannot fail. */
function installDecalChunk(): boolean {
  Object.assign(THREE.ShaderChunk, { [GODOT_DECAL_PARS_CHUNK]: GODOT_DECAL_GLSL });
  return true;
}

const THREE_MAIN = 'void main() {';

/** Where the lit programs' call runs: after the normal and emissive maps, before the light terms read the surface. */
const LIT_CALL_ANCHOR = '#include <emissivemap_fragment>';

/**
 * The decal functions ahead of a program's `main`, and the lit programs' call. A decal's emission
 * adds after the chunk has scaled its own by the exposure, so the call scales the decal's too.
 */
const LIT_EDITS: readonly TextEdit[] = [
  {
    three: THREE_MAIN,
    godot: `#define ${SHADED_DEFINE}\n#include <${GODOT_DECAL_PARS_CHUNK}>\n${THREE_MAIN}`,
  },
  {
    three: LIT_CALL_ANCHOR,
    godot: /* glsl */ `${LIT_CALL_ANCHOR}
	GodotDecalSurface godotDecalSurface = GodotDecalSurface( diffuseColor.rgb, normal, roughnessFactor, metalnessFactor, vec3( 0.0 ), vec2( 1.0, 0.0 ) );
	godotApplyDecals( godotDecalSurface, - vViewPosition, nonPerturbedNormal );
	diffuseColor.rgb = godotDecalSurface.albedo;
	normal = godotDecalSurface.normal;
	roughnessFactor = godotDecalSurface.roughness;
	metalnessFactor = godotDecalSurface.metallic;
	totalEmissiveRadiance += godotDecalSurface.emission * ${EMISSION_EXPOSURE_FACTOR};
	${OCCLUSION_MIX} = godotDecalSurface.occlusion;`,
  },
];

/**
 * The unlit program's call, where the alpha tests leave the albedo final. The face direction flips
 * the normal of a back face as three's lit programs do.
 */
const UNLIT_FRAGMENT_EDITS: readonly TextEdit[] = [
  {
    three: THREE_MAIN,
    godot: `#include <${GODOT_DECAL_PARS_CHUNK}>\n${VARYING_DECLARATIONS}${THREE_MAIN}`,
  },
  {
    three: '#include <alphahash_fragment>',
    godot: /* glsl */ `#include <alphahash_fragment>
	#ifdef DOUBLE_SIDED
		float godotDecalFace = gl_FrontFacing ? 1.0 : - 1.0;
	#else
		float godotDecalFace = 1.0;
	#endif
	GodotDecalSurface godotDecalSurface = GodotDecalSurface( diffuseColor.rgb );
	godotApplyDecals( godotDecalSurface, ${VIEW_VARYING}, ${NORMAL_VARYING} * godotDecalFace );
	diffuseColor.rgb = godotDecalSurface.albedo;`,
  },
];

/** three's guard on the normal, which only an environment map or a skin reads, and the lines it wraps. */
const THREE_NORMAL_GUARD = '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )';

const UNLIT_VERTEX_EDITS: readonly TextEdit[] = [
  {
    three: THREE_MAIN,
    godot: `${VARYING_DECLARATIONS}${THREE_MAIN}`,
  },
  { three: THREE_NORMAL_GUARD, godot: '#if 1' },
  {
    three: '#include <project_vertex>',
    godot: `#include <project_vertex>\n\t${VIEW_VARYING} = mvPosition.xyz;\n\t${NORMAL_VARYING} = transformedNormal;`,
  },
];

/**
 * Mixes the decals into the surface of three's standard, physical and basic programs, and gives
 * every program with fog the atlas and the shown decals. A three release that rewrites a
 * replaced line keeps all its programs, and `decalShaderChunk.test.ts` fails on that release.
 * True when the programs hold the mix. A second call changes nothing.
 */
export function installGodotDecals(): boolean {
  const isPatched = installChunkEdits({
    mark: 'godotApplyDecals(',
    patch: 'decal',
    fragmentShaders: { standard: LIT_EDITS, physical: LIT_EDITS, basic: UNLIT_FRAGMENT_EDITS },
    vertexShaders: { basic: UNLIT_VERTEX_EDITS },
    requires: [
      installInstanceLayers,
      installSceneRows,
      installDecalChunk,
      installGodotOcclusion,
      installEmissionExposure,
    ],
  });
  if (!isPatched) return false;
  installMergedUniform(FOG_UNIFORMS_MERGE, atlas, decalAtlasSlot);
  installMergedUniform(FOG_UNIFORMS_MERGE, shown, shownDecals);
  return true;
}
