/**
 * Godot's normal map read: red and green only, with blue rebuilt as `sqrt(max(0, 1 - dot(xy, xy)))`
 * (`scene_forward_clustered.glsl:1437-1438`), since an RGTC import stores no blue. three rebuilds
 * blue the same way under `USE_PACKED_NORMALMAP`, which it defines itself only for an RG format.
 * The map is read in a frame whose tangent and binormal have unit length, as Godot's are. The
 * tangent-space read is one function, so the roughness limiter can read a neighbouring texel.
 */

import type * as THREE from 'three';
import {
  applyChunkEdits,
  editedChunk,
  editedProgram,
  installChunkPatch,
  type ChunkEdit,
  type TextEdit,
} from '../shaderPatch/chunkPatch';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';

const PARS_CHUNK = 'normalmap_pars_fragment';
const MAPS_CHUNK = 'normal_fragment_maps';
const BEGIN_CHUNK = 'normal_fragment_begin';
const PARS_INCLUDE = `#include <${PARS_CHUNK}>`;

/**
 * three's frame scales both axes by the longer one, so a quad with a UV density that differs per
 * axis squashes the shorter. Godot normalises the tangent and the binormal each
 * (`scene_forward_clustered.glsl:1437-1442`).
 */
const UNIT_TANGENT_FRAME_EDIT: TextEdit = {
  three: `float det = max( dot( T, T ), dot( B, B ) );
\t\tfloat scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
\t\treturn mat3( T * scale, B * scale, N );`,
  godot: `float lengthT = length( T );
\t\tfloat lengthB = length( B );
\t\treturn mat3( lengthT == 0.0 ? vec3( 0.0 ) : T / lengthT, lengthB == 0.0 ? vec3( 0.0 ) : B / lengthB, N );`,
};

/**
 * The frame every program that builds one from the screen derivatives compiles with: a normal map
 * reads it, and so does anisotropy, whose lobe turns with the tangent.
 */
export const GODOT_UNIT_TANGENT_FRAME: ProgramInjection = {
  cacheKey: 'unit-tangent-frame',
  onBeforeCompile(shader) {
    const godot = editedChunk(PARS_CHUNK, UNIT_TANGENT_FRAME_EDIT);
    editedProgram(shader, { fragment: [{ three: PARS_INCLUDE, godot }] }, 'unit tangent frame');
  },
};

export const GODOT_NORMAL_MAP_READ = composeInjections([
  defining('USE_PACKED_NORMALMAP'),
  GODOT_UNIT_TANGENT_FRAME,
]) as ProgramInjection;

/**
 * The read a glTF material needs, which Godot imports as a StandardMaterial3D
 * (`gltf_document.cpp:2939-2940`): Godot's when it has a normal map, else none.
 */
export function importedNormalMapRead(material: THREE.Material): ProgramInjection | undefined {
  return (material as THREE.MeshStandardMaterial).normalMap ? GODOT_NORMAL_MAP_READ : undefined;
}

const THREE_NON_PERTURBED_NORMAL = 'vec3 nonPerturbedNormal = normal;';

/** The map UV's screen gradients, once for the pixel's read and the roughness limiter's. */
const GODOT_UV_GRADIENTS = `${THREE_NON_PERTURBED_NORMAL}
#ifdef USE_NORMALMAP_TANGENTSPACE
	vec2 godotUvDx = dFdx( vNormalMapUv );
	vec2 godotUvDy = dFdy( vNormalMapUv );
#endif`;

const THREE_NORMAL_SCALE = 'uniform vec2 normalScale;\n#endif';

/**
 * The tangent-space read as one function of the texel's UV and gradients, so the roughness limiter
 * (`godotLightFunction.ts`) reads a neighbouring texel exactly as the pixel does. `textureGrad`
 * takes the gradients explicitly: the limiter's offset UV has none of its own.
 */
const GODOT_MAP_NORMAL = /* glsl */ `uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_TANGENTSPACE
	vec3 godotMapNormal( const in vec2 uv, const in vec2 uvDx, const in vec2 uvDy, const in mat3 tbn ) {
		vec3 mapN = textureGrad( normalMap, uv, uvDx, uvDy ).xyz * 2.0 - 1.0;
		#if defined( USE_PACKED_NORMALMAP )
			mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
		#endif
		mapN.xy *= normalScale;
		return normalize( tbn * mapN );
	}
#endif`;

const THREE_TANGENT_READ = `	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );`;

const GODOT_TANGENT_READ = '\tnormal = godotMapNormal( vNormalMapUv, godotUvDx, godotUvDy, tbn );';

const GODOT_NORMAL_MAP_EDITS: readonly ChunkEdit<
  typeof PARS_CHUNK | typeof MAPS_CHUNK | typeof BEGIN_CHUNK
>[] = [
  { chunk: PARS_CHUNK, three: THREE_NORMAL_SCALE, godot: GODOT_MAP_NORMAL },
  { chunk: BEGIN_CHUNK, three: THREE_NON_PERTURBED_NORMAL, godot: GODOT_UV_GRADIENTS },
  { chunk: MAPS_CHUNK, three: THREE_TANGENT_READ, godot: GODOT_TANGENT_READ },
];

/** The text that proves the patch installed, which a patch that reads `godotMapNormal` requires. */
export const NORMAL_MAP_READ_MARK = 'vec3 godotMapNormal(';

/**
 * Replaces three's tangent-space normal read for every program compiled after the call. A three
 * release that rewrites the lines keeps its own chunks, and `godotNormalMap.test.ts` fails on it.
 */
export function installGodotNormalMapRead(): void {
  installChunkPatch({
    names: [PARS_CHUNK, BEGIN_CHUNK, MAPS_CHUNK],
    isApplied: (chunks) => chunks[PARS_CHUNK].includes(NORMAL_MAP_READ_MARK),
    apply: (chunks) => applyChunkEdits(chunks, GODOT_NORMAL_MAP_EDITS),
    missing: `${PARS_CHUNK}, ${BEGIN_CHUNK} or ${MAPS_CHUNK} lacks a line the normal map read patch replaces`,
  });
}
