/**
 * The rows of a scene's reflection probes and decals, which one float texture holds: a fragment shader
 * has 16 texture units, and a material with many maps needs them all. The probes' rows come first, in
 * the rows the atlas has layers for, and the decals' follow.
 */

import * as THREE from 'three';
import { REFLECTION_ATLAS_COUNT } from '../../godot/rendering/environment/reflectionProbe.js';
import { FOG_UNIFORMS_MERGE, installMergedUniform } from '../shaderPatch/litUniform.js';
import { SCENE_ROWS_UNIFORM, sceneRowsSlot } from './sceneRowsSlot.js';

/** The texels of each row, whether it describes a probe or a decal. A decal leaves the last one unused. */
export const SCENE_ROW_TEXELS = 8;

/** The row of the first decal: the rows before it are the probes', and a scene holds at most this many. */
export const DECAL_FIRST_ROW = REFLECTION_ATLAS_COUNT;

/** The chunk that declares the texture and the fetch, which each patch that reads a row includes. */
export const SCENE_ROWS_CHUNK = 'godot_scene_rows_pars';

/** Guarded, so a program that includes it from two patches declares the texture once. */
const SCENE_ROWS_GLSL = /* glsl */ `
#ifndef GODOT_SCENE_ROWS
#define GODOT_SCENE_ROWS
uniform highp sampler2D ${SCENE_ROWS_UNIFORM};

vec4 godotSceneRowTexel( int row, int texel ) {
	return texelFetch( ${SCENE_ROWS_UNIFORM}, ivec2( texel, row ), 0 );
}
#endif
`;

/**
 * Declares the rows for a patch to include, and gives the slot to every program with a fog uniform,
 * which is every program a surface or a helper draws with. True: it cannot fail. A second call
 * changes nothing.
 */
export function installSceneRows(): boolean {
  Object.assign(THREE.ShaderChunk, { [SCENE_ROWS_CHUNK]: SCENE_ROWS_GLSL });
  installMergedUniform(FOG_UNIFORMS_MERGE, SCENE_ROWS_UNIFORM, sceneRowsSlot);
  return true;
}
