/**
 * Godot's normal map read: red and green only, with blue rebuilt as `sqrt(max(0, 1 - dot(xy, xy)))`
 * (`scene_forward_clustered.glsl:1437-1438`), since an RGTC import stores no blue. three rebuilds
 * blue the same way under `USE_PACKED_NORMALMAP`, which it defines itself only for an RG format.
 * The map is read in a frame whose tangent and binormal have unit length, as Godot's are.
 */

import type * as THREE from 'three';
import { editedChunk, type TextEdit } from '../shaderPatch/chunkPatch';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';

const PARS_CHUNK_NAME = 'normalmap_pars_fragment';
const PARS_INCLUDE = `#include <${PARS_CHUNK_NAME}>`;

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
    const edited = editedChunk(PARS_CHUNK_NAME, UNIT_TANGENT_FRAME_EDIT);
    // A replacement function, not a string: a `$` in GLSL stays literal.
    shader.fragmentShader = shader.fragmentShader.replace(PARS_INCLUDE, () => edited);
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
