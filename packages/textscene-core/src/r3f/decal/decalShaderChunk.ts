/**
 * Godot's decals in three's programs (`scene_forward_clustered.glsl:1535-1654`): each fragment of a
 * lit or unlit surface mixes in the albedo of every decal whose box holds it and whose mask the
 * instance's layers meet. The mix runs per fragment, on the interpolated position, so a surface
 * takes a decal whatever its triangles are. The highest row of each group of 32 mixes first.
 */

import * as THREE from 'three';
import { installChunkEdits, type TextEdit } from '../shaderPatch/chunkPatch.js';
import { FOG_UNIFORMS_MERGE, installMergedUniform } from '../shaderPatch/litUniform.js';
import {
  INSTANCE_LAYERS_CHUNK,
  INSTANCE_LAYERS_UNIFORM,
  installInstanceLayers,
} from '../instanceLayers/instanceLayersChunk.js';
import { DECAL_UNIFORMS, decalAtlasSlot, decalRowsSlot, shownDecals } from './decalSlots.js';

const { atlas, rows, shown } = DECAL_UNIFORMS;

/** The chunk that holds the decal functions, which each program that mixes decals includes. */
const GODOT_DECAL_PARS_CHUNK = 'godot_decal_pars';

const VIEW_VARYING = 'vGodotDecalView';
const NORMAL_VARYING = 'vGodotDecalNormal';
const VARYING_DECLARATIONS = `varying vec3 ${VIEW_VARYING};\nvarying vec3 ${NORMAL_VARYING};\n`;

/**
 * The decal functions, all in view space, as Godot's rows are. `shown` holds the count and the
 * factor that scales the gradients, as `godotMipmapBiasedGrad` does. A normal of zero length
 * stays zero, as `normalize` of it is NaN, which a mix would carry into the albedo.
 */
const GODOT_DECAL_GLSL = /* glsl */ `
uniform highp sampler2D ${atlas};
uniform highp sampler2D ${rows};
uniform vec4 ${shown}[ 1 ];
#include <${INSTANCE_LAYERS_CHUNK}>

vec4 godotDecalTexel( int index, int texel ) {
	return texelFetch( ${rows}, ivec2( texel, index ), 0 );
}

vec3 godotMixDecal( int index, vec3 albedo, vec3 position, vec3 normal, vec3 positionDx, vec3 positionDy, float gradientScale ) {
	vec4 toLocalX = godotDecalTexel( index, 0 );
	vec4 toLocalY = godotDecalTexel( index, 1 );
	vec4 toLocalZ = godotDecalTexel( index, 2 );
	vec4 point = vec4( position, 1.0 );
	vec3 local = vec3( dot( toLocalX, point ), dot( toLocalY, point ), dot( toLocalZ, point ) );
	if ( any( lessThan( local, vec3( 0.0, - 1.0, 0.0 ) ) ) || any( greaterThan( local, vec3( 1.0 ) ) ) ) return albedo;
	vec4 maskAndFades = godotDecalTexel( index, 6 );
	if ( ( ( uint( maskAndFades.x ) | ( uint( maskAndFades.y ) << 16u ) ) & ${INSTANCE_LAYERS_UNIFORM}[ 0 ] ) == 0u ) return albedo;
	float fade = pow( 1.0 - abs( local.y ), local.y > 0.0 ? maskAndFades.z : maskAndFades.w );
	vec4 upAndFade = godotDecalTexel( index, 3 );
	if ( upAndFade.w > 0.0 ) fade *= smoothstep( upAndFade.w, 1.0, dot( normal, upAndFade.xyz ) * 0.5 + 0.5 );
	vec2 gradientX = vec2( dot( toLocalX.xyz, positionDx ), dot( toLocalZ.xyz, positionDx ) ) * gradientScale;
	vec2 gradientY = vec2( dot( toLocalX.xyz, positionDy ), dot( toLocalZ.xyz, positionDy ) ) * gradientScale;
	vec4 rect = godotDecalTexel( index, 4 );
	vec4 decalAlbedo = textureGrad( ${atlas}, local.xz * rect.zw + rect.xy, gradientX * rect.zw, gradientY * rect.zw );
	decalAlbedo *= godotDecalTexel( index, 5 );
	return mix( albedo, decalAlbedo.rgb, decalAlbedo.a * fade );
}

vec3 godotApplyDecals( vec3 albedo, vec3 position, vec3 normal ) {
	int count = int( ${shown}[ 0 ].x );
	if ( count == 0 ) return albedo;
	float normalLength = length( normal );
	vec3 geometryNormal = normalLength > 0.0 ? normal / normalLength : normal;
	vec3 positionDx = dFdx( position );
	vec3 positionDy = dFdy( position );
	float gradientScale = ${shown}[ 0 ].y;
	for ( int group = 0; group < count; group += 32 ) {
		for ( int index = min( group + 31, count - 1 ); index >= group; index -- ) {
			albedo = godotMixDecal( index, albedo, position, geometryNormal, positionDx, positionDy, gradientScale );
		}
	}
	return albedo;
}
`;

/** Declares the decal functions for a program to include. True: it cannot fail. */
function installDecalChunk(): boolean {
  Object.assign(THREE.ShaderChunk, { [GODOT_DECAL_PARS_CHUNK]: GODOT_DECAL_GLSL });
  return true;
}

const THREE_MAIN = 'void main() {';

/** The decal functions ahead of a program's `main`, and the lit programs' call once the geometry normal exists. */
const LIT_EDITS: readonly TextEdit[] = [
  { three: THREE_MAIN, godot: `#include <${GODOT_DECAL_PARS_CHUNK}>\n${THREE_MAIN}` },
  {
    three: '#include <normal_fragment_begin>',
    godot: `#include <normal_fragment_begin>\n\tdiffuseColor.rgb = godotApplyDecals( diffuseColor.rgb, - vViewPosition, normal );`,
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
	diffuseColor.rgb = godotApplyDecals( diffuseColor.rgb, ${VIEW_VARYING}, ${NORMAL_VARYING} * godotDecalFace );`,
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
 * Mixes the decals into the albedo of three's standard, physical and basic programs, and gives
 * every program with fog the atlas, the rows and the shown decals. A three release that rewrites a
 * replaced line keeps all its programs, and `decalShaderChunk.test.ts` fails on that release.
 * True when the programs hold the mix. A second call changes nothing.
 */
export function installGodotDecals(): boolean {
  const isPatched = installChunkEdits({
    mark: 'godotApplyDecals(',
    patch: 'decal',
    fragmentShaders: { standard: LIT_EDITS, physical: LIT_EDITS, basic: UNLIT_FRAGMENT_EDITS },
    vertexShaders: { basic: UNLIT_VERTEX_EDITS },
    requires: [installInstanceLayers, installDecalChunk],
  });
  if (!isPatched) return false;
  installMergedUniform(FOG_UNIFORMS_MERGE, atlas, decalAtlasSlot);
  installMergedUniform(FOG_UNIFORMS_MERGE, rows, decalRowsSlot);
  installMergedUniform(FOG_UNIFORMS_MERGE, shown, shownDecals);
  return true;
}
